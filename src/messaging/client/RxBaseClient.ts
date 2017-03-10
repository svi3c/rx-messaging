import { Socket } from "net";
import { Observer } from "rxjs/Observer";
import { Observable } from "rxjs/Observable";
import { Subscription } from "rxjs/Subscription";
import { Subject } from "rxjs/Subject";
import "rxjs/add/operator/filter";
import "rxjs/add/operator/share";
import "rxjs/add/operator/finally";
import { TypedError } from "../Error";
import { RxSocket, IMessage, IRequest, IResponse, ISubscribe, MessageType } from "../RxSocket";
import { isDefined } from "../utils";
import { ClientConnector, ConnectionEventType, IConnectionOptions, IConnectionEvent } from "./ClientConnector";
import { BackoffAlgorithm } from "./BackoffAlgorithms";

/**
 * A basic client which exposes the received messages as an observable.
 */
export class RxBaseClient {

  private static nextRequestId = 1;

  messages$: Observable<IMessage>;
  events$: Observable<IConnectionEvent>;
  private _queue: { message: IMessage, resolve: Function }[] = [];
  private _messageRetryBackoff: Iterator<number>;
  private _rxSocket: RxSocket;
  private _connector: ClientConnector = new ClientConnector(this._connectionOptions, this._reconnectAlgorithm);
  private _messagesSubscription: Subscription;
  private _messagesSubject: Subject<IMessage> = new Subject<IMessage>();

  constructor(private _connectionOptions: IConnectionOptions,
    private _reconnectAlgorithm?: BackoffAlgorithm,
    private _messageRetryAlgorithm?: BackoffAlgorithm) {
    this.messages$ = this._messagesSubject.asObservable()
      .filter(message => message.type === MessageType.message);
    this.events$ = this._connector.events$;
    this._connector.events$.subscribe((event: IConnectionEvent) => {
      switch (event.type) {
        case ConnectionEventType.connect:
          this._rxSocket = new RxSocket(event.payload as Socket);
          this._messagesSubscription = this._rxSocket.messages$.subscribe(this._messagesSubject);
          this._queue.forEach(item => this._rxSocket.send(item.message).then(() => item.resolve()));
          this._queue.length = 0;
          break;
        case ConnectionEventType.close:
          this._rxSocket = null;
          break;
      }
    });
  }

  /**
   * Starts connecting to the server.
   */
  connect() {
    return this._connector.connect();
  }

  /**
   * Disconnects from the server.
   */
  disconnect() {
    return this._connector.disconnect();
  }

  /**
   * Sends ta request message to the server and returns an observable for the response.
   * @param request the request
   * @returns {Observable} An observable for the request.
   */
  request = (request: IRequest) => {
    request.id = request.id || RxBaseClient.nextRequestId++;
    request.type = isDefined(request.type) ? request.type : MessageType.request;
    return Observable.create((observer: Observer<IResponse>) => {
      this.send(request);
      let subscription = this._rxSocket.messages$
        .filter((response: IResponse) => response.id === request.id)
        .subscribe((response: IResponse) => {
          if (response.error) {
            observer.error(new TypedError(response.error));
          } else {
            observer.next(response);
            observer.complete();
          }
          subscription.unsubscribe();
        });
    });
  };

  /**
   * Adds a subscription on server events.
   * @param request
   * @returns {Observable<IMessage>}
   */
  subscribe = (request: ISubscribe) => {
    request.type = MessageType.subscribe;
    request.id = request.id || RxBaseClient.nextRequestId++;
    return this.request(request);
  };

  /**
   * Sends a message to the server.
   * It will retry with an exponential backoff, if an error occurs.
   * @param message The message to send.
   */
  send = (message: IMessage) => {
    if (!this._rxSocket) {
      return new Promise<void>(resolve =>
        this._queue.push({ message, resolve }));
    } else {
      this._rxSocket
        .send(message)
        .then(
        () => this._messageRetryBackoff = null,
        (err) => {
          this._messageRetryBackoff = this._messageRetryBackoff || this._messageRetryAlgorithm && this._messageRetryAlgorithm();
          const delay = this._messageRetryBackoff ? this._messageRetryBackoff.next() : 0;
          console.warn(`Failed to send message ${JSON.stringify(message)}."`, err);
          console.warn(`Retrying to send message in ${delay}ms`);
          return new Promise(resolve =>
            setTimeout(() => resolve(this.send(message)), delay));
        }
        );
    }
  };

}