import {ConnectionOptions as TlsConnectionOptions} from "tls";
import "rxjs/add/operator/share";
import {RxBaseClient, ITcpConnectionOptions} from "./RxBaseClient";
import {Observable} from "rxjs/Observable";
import {MessageType, IMessage, IRequest, ISubscribe} from "../RxSocket";

/**
 * A client for the {@link RxServer}.
 */
export class RxClient {

  baseClient: RxBaseClient;
  private channels: Map<String, Observable<IMessage>> = new Map<String, Observable<IMessage>>();

  constructor(connectionOptions: RxBaseClient | ITcpConnectionOptions | TlsConnectionOptions) {
    this.baseClient = (connectionOptions instanceof RxBaseClient) ? connectionOptions : new RxBaseClient(connectionOptions);
  }

  send = (channel: string, data?: any) => this.baseClient.send({
    channel,
    data,
    type: MessageType.message
  } as IMessage);

  request = (channel: string, data?: any) => this.baseClient.request({
    channel,
    data
  } as IRequest);

  subscribe = (channel: string) => {
    let channel$ = this.channels.get(channel);
    if (channel$) {
      return Promise.resolve(channel$);
    } else {
      channel$ = (this.baseClient.messages$ as Observable<IMessage>)
        .filter(message => message.channel === channel);
      return this.baseClient
        .subscribe({channel} as ISubscribe).toPromise()
        .then(() => {
          this.channels.set(channel, channel$);
          return channel$;
        });
    }
  };

  on(event: string, listener: Function) {
    this.baseClient.on(event, listener);
  }

  disconnect = () => this.baseClient.disconnect();

}