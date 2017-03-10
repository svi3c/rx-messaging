import { createServer as createTcpServer, Server, Socket } from "net";
import "rxjs/add/operator/share";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Rx";
import { createServer as createTlsServer, TlsOptions } from "tls";
import { IErrorData } from "../Error";
import {
  IMessage, IRequest, IResponse, ISubscribe, IUnsubscribe, MessageType, RxSocket,
} from "../RxSocket";

export type IIncomingSubscribe = IIncomingMessage & ISubscribe;
export type IIncomingUnsubscribe = IIncomingMessage & IUnsubscribe;
export interface IIncomingRequest extends IIncomingMessage, IRequest {
}

export interface IIncomingMessage extends IMessage {
  socket: RxSocket;
}

export class IncomingRequest implements IIncomingRequest {

  public id: number;
  public data: any;
  public channel: string;
  public type: MessageType;
  public socket: RxSocket;

  constructor(msg: IIncomingMessage) {
    Object.assign(this, msg);
  }

  respond = (data?: any) => {
    let res = {
      id: this.id,
      type: MessageType.response,
    } as IResponse;
    if (this.channel) {
      res.channel = this.channel;
    }
    if (data) {
      res.data = data;
    }
    return this.socket.send(res);
  }
  respondError = (error: IErrorData) => {
    let res = {
      requestId: this.id,
      type: MessageType.response,
      error,
    } as IMessage;
    if (this.channel) {
      res.channel = this.channel;
    }
    return this.socket.send(res);
  }
}

export interface IServerMessageSource {
  messages$: Observable<IIncomingMessage>;
  requests$: Observable<IIncomingRequest>;
  subscribes$: Observable<IIncomingSubscribe>;
  unsubscribes$: Observable<IIncomingUnsubscribe>;
}

/**
 * A TCP/TLS server wrapper which is an Observable emitting incoming messages.
 */
export class RxBaseServer implements IServerMessageSource {
  server: Server;

  messages$: Observable<IIncomingMessage>;
  requests$: Observable<IIncomingRequest>;
  subscribes$: Observable<IIncomingSubscribe>;
  unsubscribes$: Observable<IIncomingUnsubscribe>;

  /**
   * Creates an RxServer from an existing server or with a given configuration.
   * @param serverOrOptions Either the server to wrap or the TLS options (a TLS server will be created) or nothing (
   *   a TCP server will be created).
   */
  constructor(serverOrOptions?: Server | TlsOptions) {
    this.server =
      !serverOrOptions ? createTcpServer() :
        (serverOrOptions as Server).listen ? serverOrOptions as Server :
          createTlsServer(serverOrOptions);
    let subject: Subject<IIncomingMessage> = new Subject<IIncomingMessage>();
    let messages$ = subject.asObservable().share();
    this.messages$ = messages$
      .filter((m) => m.type === MessageType.message)
      .share();
    this.requests$ = (messages$ as Observable<IIncomingRequest>)
      .filter((m) => m.type === MessageType.request)
      .map((m) => new IncomingRequest(m) as IIncomingRequest)
      .share();
    this.subscribes$ = (messages$ as Observable<IIncomingSubscribe>)
      .filter((m) => m.type === MessageType.subscribe)
      .map((m) => new IncomingRequest(m) as IIncomingSubscribe)
      .share();
    this.unsubscribes$ = (messages$ as Observable<IIncomingUnsubscribe>)
      .filter((m) => m.type === MessageType.unsubscribe)
      .map((m) => new IncomingRequest(m) as IIncomingUnsubscribe)
      .share();

    this.server.on("connection", (socket: Socket) => {
      let rxSocket = new RxSocket(socket);
      rxSocket.messages$.subscribe(subject);
    });
  }

  /**
   * Delegates to the server's {@link Server.listen} function.
   * @param port The port to listen to
   */
  listen = (port: number) => new Promise<void>((resolve, reject) =>
    this.server.listen(port, (err) => err ? reject(err) : resolve()),
  );

  close = () => new Promise<void>((resolve) => {
    this.server.removeAllListeners();
    this.server.close(resolve);
  })

}
