import {connect as connectTls, ConnectionOptions as TlsConnectionOptions} from "tls";
import {connect as connectTcp, Socket} from "net";
import {Observer} from "rxjs/Observer";
import {Observable} from "rxjs/Observable";
import "rxjs/add/operator/filter";
import "rxjs/add/operator/share";
import "rxjs/add/operator/finally";
import {TypedError} from "../Error";
import {EventEmitter} from "events";
import {RxSocket, IMessage, IRequest, IResponse, ISubscribe, MessageType} from "../RxSocket";
import {isDefined} from "../utils";

export interface ITcpConnectionOptions {
  port?: number;
  host?: string;
  localAddress?: string;
  localPort?: string;
  family?: number;
  allowHalfOpen?: boolean;
}

export enum ConnectionState {
  disconnecting,
  disconnected,
  connecting,
  connected
}

export interface IOptions extends ITcpConnectionOptions, TlsConnectionOptions {
  messageRetries?: number;
  messageBackoffLimit?: number;
  connectionRetries?: number;
  connectionBackoffLimit?: number;
}

const defaultOptions: IOptions = {
  messageRetries: 10,
  messageBackoffLimit: 3000,
  connectionRetries: 30,
  connectionBackoffLimit: 10000
};

interface IRemoteSubscription {
  request: IRequest;
  observer: Observer<IMessage>;
}

/**
 * A TCP/TLS server wrapper which holds an Observable emitting incoming messages.
 * It keeps a persistent on-demand-connection to the server
 */
export class RxBaseClient extends EventEmitter {

  private static nextRequestId = 1;

  messages$: Observable<IMessage>;
  private socket: Socket;
  private state: ConnectionState = ConnectionState.disconnected;
  private connectionRetries: number = 0;
  private messageRetries: number = 0;
  private rxSocket: RxSocket;
  private remoteSubscription: IRemoteSubscription;
  private options: IOptions;

  /**
   * Creates an RxClient.
   * @param options If the options are passed in, {@link RxClient#connect()} will be directly called on the instance.
   */
  constructor(options?: IOptions) {
    super();
    if (options) {
      Object.assign(this.options = {}, options, defaultOptions);
      this.connect(options);
    }
  }

  /**
   * Establishes a persistent on-demand-connection to a server. When the connection is lost, it will retry connecting
   * with an exponential backoff algorithm.
   * @param options The connection options. If not passed in, the last connectionOptions will be used.
   */
  connect = (options?: IOptions) => {
    if (!options && !this.options) {
      throw new Error("No connection options provided");
    }
    this.disconnect();
    this.state = ConnectionState.connecting;
    Object.assign(this.options = this.options || {}, options, defaultOptions);
    if ((this.options as TlsConnectionOptions).cert) {
      this.socket = connectTls(this.options) as any as Socket;
    } else {
      this.socket = connectTcp(this.options.port, this.options.host);
    }

    this.socket.on("connect", () => {
      this.state = ConnectionState.connected;
      this.connectionRetries = 0;
      this.resubscribe();
      this.emit("connect");
    });
    this.socket.on("lookup", this.onConnectionError);
    this.socket.on("error", this.onConnectionError);
    this.socket.on("close", this.connect);
    this.socket.on("end", () => this.state = ConnectionState.disconnecting);

    this.rxSocket = new RxSocket(this.socket);
    this.messages$ = this.rxSocket.messages$
      .filter(message => message.type === MessageType.message);
  };

  /**
   * Disconnects this client from the server.
   */
  disconnect = () => new Promise(resolve => {
    if (this.state === ConnectionState.connected || this.state === ConnectionState.connecting) {
      this.socket.removeAllListeners();
      this.socket.on("close", () => {
        this.state = ConnectionState.disconnected;
        resolve();
      });
      this.socket.destroy();
      this.state = ConnectionState.disconnecting;
    }
  });

  /**
   * Sends ta request message to the server and returns an observable for the response.
   * The observable will call
   * <ul>
   *   <li>next(response), if a valid response is received</li>
   *   <li>complete(), directly after next(response) was called</li>
   *   <li>error(err), if an error message is received</li>
   * </ul>
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
  };

  /**
   * Adds a subscription on server events.
   * @param request
   * @returns {Observable<IClientMessage>}
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
  send = (message: IMessage) => this.rxSocket
    .send(message)
    .then(
      () => this.messageRetries = 0,
      (err) => {
        const timeout = (Math.pow(2, this.messageRetries / this.options.connectionRetries) - 1) * this.options.connectionBackoffLimit;
        console.warn(`Failed to send message ${JSON.stringify(message)}."`, err);
        console.warn(`Retrying to send message in ${timeout}ms`);
        this.messageRetries++;
        return new Promise(resolve =>
          setTimeout(() => resolve(this.send(message)), timeout));
      }
    );

  private onConnectionError = (err) => {
    if (err) {
      const timeout = Math.pow(2, Math.min(this.connectionRetries, 4)) * 100;
      this.socket.destroy();
      console.warn(`Failed to connect to ${this.options.host}:${this.options.port} (${err.code})`);
      console.warn(`Retrying to connect in ${timeout}ms ...`);
      setTimeout(this.connect, timeout);
      this.connectionRetries++;
    }
  };

  private resubscribe() {
    if (this.remoteSubscription) {
      this.request(this.remoteSubscription.request).subscribe(null, (err) => {
        console.error(`Failed to re-subscribe with request ${JSON.stringify(this.remoteSubscription.request)}`, err);
        this.remoteSubscription.observer.error(err);
      });
    }
  }
}