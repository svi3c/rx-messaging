import { Observable } from "rxjs/Observable";
import { Observer } from "rxjs/Observer";
import JsonSocket = require("json-socket");
import { Socket } from "net";
import { IErrorData } from "./Error";
import "rxjs/add/operator/share";
import { isDefined } from "./utils";
import { EventEmitter } from "events";

export enum MessageType {
  subscribe,
  unsubscribe,
  message,
  request,
  response,
}

export type ISubscribe = IRequest;
export type IUnsubscribe = IRequest;

export interface IRequest extends IMessage {
  id?: number;
  respond?: (data?: any) => Promise<void>;
  respondError?: (error: IErrorData) => Promise<void>;
}

export interface IResponse extends IMessage {
  id: number;
}

export interface IMessage {
  data?: any;
  error?: IErrorData;
  channel?: string;
  type?: MessageType;
}

interface ISerializedMessage {
  d?: any;        // data
  e?: {           // error
    m: string;
    c: string;
  };
  c?: string;     // channel
  i?: number;     // id
  r?: number;     // requestId
  t: MessageType; // type
}

export class RxSocket extends EventEmitter {

  messages$: Observable<IMessage>;
  private jsonSocket: JsonSocket;

  constructor(socket: Socket) {
    super();
    this.jsonSocket = new JsonSocket(socket);
    let observer: Observer<IMessage>;
    this.messages$ = new Observable<IMessage>(o => observer = o).share();
    this.jsonSocket.on("message", msg => observer.next(this.parseMessage(msg)));
    this.jsonSocket.on("close", () => this.emit("close"));
  }

  send = (message: IMessage) =>
    new Promise<void>((resolve, reject) =>
      this.jsonSocket.sendMessage(this.serializeMessage(message), (error: Error) => error ? reject(error) : resolve()));

  private parseMessage = (msg: ISerializedMessage) => {
    let message = {
      type: msg.t,
      socket: this
    } as IMessage;
    if (isDefined(msg.d))
      message.data = msg.d;
    if (isDefined(msg.e))
      message.error = {
        message: msg.e.m,
        code: msg.e.c
      };
    if (isDefined(msg.c))
      message.channel = msg.c;
    if (isDefined(msg.i))
      (message as IRequest).id = msg.i;
    return message;
  };

  private serializeMessage = (msg: IMessage) => {
    let message: ISerializedMessage = {
      t: msg.type
    };
    if (isDefined(msg.data))
      message.d = msg.data;
    if (isDefined(msg.error))
      message.e = {
        m: msg.error.message,
        c: msg.error.code
      };
    if (isDefined(msg.channel))
      message.c = msg.channel;
    if (isDefined((msg as IRequest).id))
      message.i = (msg as IRequest).id;
    return message;
  }

}

export default RxSocket;