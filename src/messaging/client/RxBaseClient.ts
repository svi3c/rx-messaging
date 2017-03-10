import { Socket } from "net";
import "rxjs/add/operator/filter";
import "rxjs/add/operator/finally";
import "rxjs/add/operator/share";
import { Observable } from "rxjs/Observable";
import { Observer } from "rxjs/Observer";
import { Subject } from "rxjs/Subject";
import { Subscription } from "rxjs/Subscription";
import { TypedError } from "../Error";
import { IMessage, IRequest, IResponse, ISubscribe, MessageType, RxSocket } from "../RxSocket";
import { isDefined } from "../utils";
import { BackoffAlgorithm } from "./BackoffAlgorithms";
import { ClientConnector, ConnectionEventType, IConnectionEvent, IConnectionOptions } from "./ClientConnector";

/**
 * A basic client which exposes the received messages as an observable.
 */
export class RxBaseClient {

  private static nextRequestId = 1;

  messages$: Observable<IMessage>;
  events$: Observable<IConnectionEvent>;
  private queue: Array<{ message: IMessage, resolve: Function }> = [];
  private messageRetryBackoff: Iterator<number>;
  private rxSocket: RxSocket;
  private connector: ClientConnector = new ClientConnector(this.connectionOptions, this.reconnectAlgorithm);
  private messagesSubscription: Subscription;
  private messagesSubject: Subject<IMessage> = new Subject<IMessage>();

  constructor(private connectionOptions: IConnectionOptions,
              private reconnectAlgorithm?: BackoffAlgorithm,
              private messageRetryAlgorithm?: BackoffAlgorithm) {
    this.messages$ = this.messagesSubject.asObservable()
      .filter((message) => message.type === MessageType.message);
    this.events$ = this.connector.events$;
    this.connector.events$.subscribe((event: IConnectionEvent) => {
      switch (event.type) {
        case ConnectionEventType.connect:
          this.rxSocket = new RxSocket(event.payload as Socket);
          this.messagesSubscription = this.rxSocket.messages$.subscribe(this.messagesSubject);
          this.queue.forEach((item) => this.rxSocket.send(item.message).then(() => item.resolve()));
          this.queue.length = 0;
          break;
        case ConnectionEventType.close:
          this.rxSocket = null;
          break;
      }
    });
  }

  /**
   * Starts connecting to the server.
   */
  connect() {
    return this.connector.connect();
  }

  /**
   * Disconnects from the server.
   */
  disconnect() {
    return this.connector.disconnect();
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
      let subscription = this.rxSocket.messages$
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
  }

  /**
   * Adds a subscription on server events.
   * @param request
   * @returns {Observable<IMessage>}
   */
  subscribe = (request: ISubscribe) => {
    request.type = MessageType.subscribe;
    request.id = request.id || RxBaseClient.nextRequestId++;
    return this.request(request);
  }

  /**
   * Sends a message to the server.
   * It will retry with an exponential backoff, if an error occurs.
   * @param message The message to send.
   */
  send = (message: IMessage) => {
    if (!this.rxSocket) {
      return new Promise<void>((resolve) =>
        this.queue.push({ message, resolve }));
    } else {
      this.rxSocket
        .send(message)
        .then(
        () => this.messageRetryBackoff = null,
        (err) => {
          this.messageRetryBackoff = this.messageRetryBackoff || this.messageRetryAlgorithm && this.messageRetryAlgorithm();
          const delay = this.messageRetryBackoff ? this.messageRetryBackoff.next() : 0;
          console.warn(`Failed to send message ${JSON.stringify(message)}."`, err);
          console.warn(`Retrying to send message in ${delay}ms`);
          return new Promise((resolve) =>
            setTimeout(() => resolve(this.send(message)), delay));
        },
        );
    }
  }

}
