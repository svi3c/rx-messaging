import {connect as connectTls, ConnectionOptions} from "tls";
import {connect as connectTcp, Socket} from "net";
import {Observable} from "rxjs/Observable";
import {Observer} from "rxjs/Observer";
import {Subject} from "rxjs/Subject";
import {Subscription} from "rxjs/Subscription";
import {BackoffAlgorithm} from "./BackoffAlgorithms";
import {RxSocket} from "../RxSocket";

export interface IConnectionOptions extends ConnectionOptions {
  port: number;
}

export enum ConnectionEventType {
  connect,
  error,
  close
}

export interface IConnectionEvent {
  type: ConnectionEventType;
  payload?: any;
}

/**
 * A connector to connect to a given tcp/tls server.
 */
export class ClientConnector {

  socket: Socket;
  events$: Observable<IConnectionEvent>;
  private _eventsObserver: Observer<IConnectionEvent>;
  private _connectionBackoff: Iterator<number>;
  private _connectingSubscription: Subscription;
  private _timeout: NodeJS.Timer;

  /**
   * Creates a connector.
   * @param connectionOptions The connection options
   * @param reconnectAlgorithm
   */
  constructor(public connectionOptions: IConnectionOptions,
              public reconnectAlgorithm?: BackoffAlgorithm) {
    let subject = new Subject<IConnectionEvent>();
    this._eventsObserver = subject;
    this.events$ = subject.asObservable();
  }

  /**
   * Starts connecting to the server.
   * @param delay
   * @returns {Promise<Socket>}
   */
  connect(delay = 0) {
    return new Promise<RxSocket>((resolve, reject) => {
      this._timeout = setTimeout(() => {
        let connect: any = this.connectionOptions.cert ? connectTls : connectTcp;
        this._timeout = null;
        this.socket = connect(this.connectionOptions);
        this._attachListenersToSocket();
        this._connectingSubscription = this.events$.subscribe(event => {
          this._connectingSubscription.unsubscribe();
          this._connectingSubscription = null;
          switch (event.type) {
            case ConnectionEventType.error:
              reject(event.payload);
              break;
            case ConnectionEventType.connect:
              resolve(new RxSocket(event.payload));
              break;
          }
        });
      }, delay);
    });
  }

  /**
   * Disconnects from the server.
   * @returns {Promise<void>}
   */
  disconnect() {
    return new Promise<void>(resolve => {
      if (this._timeout) {
        clearTimeout(this._timeout);
        this._timeout = null;
      }
      if (this._connectingSubscription) {
        this._connectingSubscription.unsubscribe();
        this._connectingSubscription = null;
      }
      this.socket.removeAllListeners();
      this.socket.once("close", () => resolve());
      this.socket.destroy();
      this.socket = null;
    });
  }

  private _attachListenersToSocket() {
    this.socket.on("connect", () => {
      this._eventsObserver.next({type: ConnectionEventType.connect, payload: this.socket});
      this._connectionBackoff = null;
    });
    this.socket.on("error", err => {
      this.socket.destroy();
      this._eventsObserver.next({type: ConnectionEventType.error, payload: err});
    });
    this.socket.on("close", () => {
      this.socket.removeAllListeners();
      this.socket = null;
      this._eventsObserver.next({type: ConnectionEventType.close});
      this._connectionBackoff = this._connectionBackoff || this.reconnectAlgorithm && this.reconnectAlgorithm();
      this.connect(this._connectionBackoff ? this._connectionBackoff.next().value : 0);
    });
  }

}