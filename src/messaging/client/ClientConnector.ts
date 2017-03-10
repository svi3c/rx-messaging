import { connect as connectTcp, Socket } from "net";
import { Observable } from "rxjs/Observable";
import { Observer } from "rxjs/Observer";
import { Subject } from "rxjs/Subject";
import { Subscription } from "rxjs/Subscription";
import { connect as connectTls, ConnectionOptions } from "tls";
import { RxSocket } from "../RxSocket";
import { BackoffAlgorithm } from "./BackoffAlgorithms";

export interface IConnectionOptions extends ConnectionOptions {
  port: number;
}

export enum ConnectionEventType {
  connect,
  error,
  close,
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
  private eventsObserver: Observer<IConnectionEvent>;
  private connectionBackoff: Iterator<number>;
  private connectingSubscription: Subscription;
  private timeout: NodeJS.Timer;

  /**
   * Creates a connector.
   * @param connectionOptions The connection options
   * @param reconnectAlgorithm
   */
  constructor(public connectionOptions: IConnectionOptions,
              public reconnectAlgorithm?: BackoffAlgorithm) {
    let subject = new Subject<IConnectionEvent>();
    this.eventsObserver = subject;
    this.events$ = subject.asObservable();
  }

  /**
   * Starts connecting to the server.
   * @param delay
   * @returns {Promise<Socket>}
   */
  connect(delay = 0) {
    return new Promise<RxSocket>((resolve, reject) => {
      this.timeout = setTimeout(() => {
        let connect: any = this.connectionOptions.cert ? connectTls : connectTcp;
        this.timeout = null;
        this.socket = connect(this.connectionOptions);
        this.attachListenersToSocket();
        this.connectingSubscription = this.events$.subscribe((event) => {
          this.connectingSubscription.unsubscribe();
          this.connectingSubscription = null;
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
    return new Promise<void>((resolve) => {
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
      if (this.connectingSubscription) {
        this.connectingSubscription.unsubscribe();
        this.connectingSubscription = null;
      }
      this.socket.removeAllListeners();
      this.socket.once("close", () => resolve());
      this.socket.destroy();
      this.socket = null;
    });
  }

  private attachListenersToSocket() {
    this.socket.on("connect", () => {
      this.eventsObserver.next({ type: ConnectionEventType.connect, payload: this.socket });
      this.connectionBackoff = null;
    });
    this.socket.on("error", (err) => {
      this.socket.destroy();
      this.eventsObserver.next({ type: ConnectionEventType.error, payload: err });
    });
    this.socket.on("close", () => {
      this.socket.removeAllListeners();
      this.socket = null;
      this.eventsObserver.next({ type: ConnectionEventType.close });
      this.connectionBackoff = this.connectionBackoff || this.reconnectAlgorithm && this.reconnectAlgorithm();
      this.connect(this.connectionBackoff ? this.connectionBackoff.next().value : 0)
        .catch(() => { });
    });
  }

}
