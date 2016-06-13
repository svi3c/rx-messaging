import {ConnectionOptions as TlsConnectionOptions} from "tls";
import "rxjs/add/operator/share";
import {RxBaseClient, ITcpConnectionOptions} from "./RxBaseClient";
import {Observable} from "rxjs/Observable";
import {MessageType, IMessage, IRequest, ISubscribe} from "../RxSocket";

/**
 * A TCP/TLS client socket wrapper which is an Observable emitting incoming messages.
 */
export class RxClient {

  private static nextRequestId = 1;
  client: RxBaseClient;
  private channels: Map<String, Observable<IMessage>> = new Map<String, Observable<IMessage>>();

  constructor(connectionOptions: RxBaseClient | ITcpConnectionOptions | TlsConnectionOptions) {
    this.client = (connectionOptions instanceof RxBaseClient) ? connectionOptions : new RxBaseClient(connectionOptions);
  }

  send = (channel: string, data?: any) => this.client.send({
    channel,
    data,
    type: MessageType.message
  } as IMessage);

  request = (channel: string, data?: any) => this.client.request({
    channel,
    data
  } as IRequest);

  subscribe = (channel: string) => {
    let channel$ = this.channels.get(channel);
    if (channel$) {
      return Promise.resolve(channel$);
    } else {
      channel$ = (this.client.messages$ as Observable<IMessage>)
        .filter(message => message.channel === channel);
      return this.client
        .subscribe({channel} as ISubscribe).toPromise()
        .then(() => {
          this.channels.set(channel, channel$);
          return channel$;
        });
    }
  };

  on(event: string, listener: Function) {
    this.client.on(event, listener);
  }

  disconnect = () => this.client.disconnect();

}