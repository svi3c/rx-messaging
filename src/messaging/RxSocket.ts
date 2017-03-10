import { Observable } from "rxjs/Observable";
import { Observer } from "rxjs/Observer";
import JsonSocket = require("json-socket");
import { EventEmitter } from "events";
import { Socket } from "net";
import "rxjs/add/operator/share";
import { IErrorData } from "./Error";
import { isDefined } from "./utils";

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
    this.messages$ = new Observable<IMessage>((o) => observer = o).share();
    this.jsonSocket.on("message", (msg) => observer.next(this.parseMessage(msg)));
    this.jsonSocket.on("close", () => this.emit("close"));
  }

  send = (message: IMessage) =>
    new Promise<void>((resolve, reject) =>
      this.jsonSocket.sendMessage(this.serializeMessage(message), (error: Error) => error ? reject(error) : resolve()));

  private parseMessage = (msg: ISerializedMessage) => {
    let message = {
      socket: this,
      type: msg.t,
    } as IMessage;
    if (isDefined(msg.d)) {
      message.data = msg.d;
    }
    if (isDefined(msg.e)) {
      message.error = {
        code: msg.e.c,
        message: msg.e.m,
      };
    }
    if (isDefined(msg.c)) {
      message.channel = msg.c;
    }
    if (isDefined(msg.i)) {
      (message as IRequest).id = msg.i;
    }
    return message;
  }

  private serializeMessage = (msg: IMessage) => {
    let message: ISerializedMessage = {
      t: msg.type,
    };
    if (isDefined(msg.data)) {
      message.d = msg.data;
    }
    if (isDefined(msg.error)) {
      message.e = {
        c: msg.error.code,
        m: msg.error.message,
      };
    }
    if (isDefined(msg.channel)) {
      message.c = msg.channel;
    }
    if (isDefined((msg as IRequest).id)) {
      message.i = (msg as IRequest).id;
    }
    return message;
  }

}

export default RxSocket;
