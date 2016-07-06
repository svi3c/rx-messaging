import {Observable} from "rxjs/Observable";
import "rxjs/add/operator/filter";
import {
  RxBaseServer, IServerMessageSource, IIncomingMessage, IIncomingRequest,
  IIncomingSubscribe, IIncomingUnsubscribe
} from "./RxBaseServer";
import {TlsOptions} from "tls";
import {Server} from "net";
import {RxSocket, IMessage, MessageType} from "../RxSocket";
import "rxjs/add/operator/share";

class OutboundChannels {
  private channels = new Map<string, Set<RxSocket>>();

  subscribe(channelName: string, socket: RxSocket) {
    let channel = this.channels.get(channelName);
    if (!channel) {
      channel = new Set<RxSocket>();
      this.channels.set(channelName, channel);
    }
    channel.add(socket);
    socket.jsonSocket.on("close", () =>
      this.unsubscribe(channelName, socket));
  }

  unsubscribe(channelName: string, socket: RxSocket) {
    let channel = this.channels.get(channelName);
    if (channel) {
      channel.delete(socket);
    }
  }

  publish(channelName: string, msg: IMessage) {
    let channel = this.channels.get(channelName);
    if (channel) {
      msg.type = msg.type || MessageType.message;
      msg.channel = channelName;
      channel.forEach(socket => socket.send(msg));
    }
  }
}

/**
 * Simplifies the data transfer between servers.
 * It is based on Rx-Observables, channels and a TCP/TLS server.
 */
export class RxServer implements IServerMessageSource {
  messages$: Observable<IIncomingMessage>;
  requests$: Observable<IIncomingRequest>;
  subscribes$: Observable<IIncomingSubscribe>;
  unsubscribes$: Observable<IIncomingUnsubscribe>;

  baseServer: RxBaseServer;

  private channels: Map<string, IServerMessageSource> = new Map<string, IServerMessageSource>();
  private outboundChannels = new OutboundChannels();

  constructor(serverOrOptions?: RxBaseServer | Server | TlsOptions) {
    this.baseServer = serverOrOptions && (serverOrOptions as RxBaseServer).messages$ ?
      serverOrOptions as RxBaseServer : new RxBaseServer(serverOrOptions);
    this.messages$ = this.baseServer.messages$
      .filter(message => !!message.channel)
      .share();
    this.requests$ = this.baseServer.requests$
      .filter(message => !!message.channel)
      .share();
    this.subscribes$ = this.baseServer.subscribes$
      .filter(message => !!message.channel)
      .share();
    this.unsubscribes$ = this.baseServer.unsubscribes$
      .filter(message => !!message.channel)
      .share();

    this.subscribes$.subscribe(message => {
      this.outboundChannels.subscribe(message.channel, message.socket);
      message.respond();
    });
    this.unsubscribes$.subscribe(message => {
      this.outboundChannels.unsubscribe(message.channel, message.socket);
      message.respond();
    });
  }

  /**
   * Retrieves or creates a hot observable which only emits messages matching the given channel name.
   * @param name The channel name
   * @returns {Observable} The observable with filtered messages.
   */
  channel(name: string) {
    let channel = this.channels.get(name);
    if (!channel) {
      channel = {
        messages$: this.messages$
          .filter(m => m.channel === name)
          .share(),
        requests$: this.requests$
          .filter(m => m.channel === name)
          .share(),
        subscribes$: this.subscribes$
          .filter(m => m.channel === name)
          .share(),
        unsubscribes$: this.unsubscribes$
          .filter(m => m.channel === name)
          .share()
      };
      this.channels.set(name, channel);
    }
    return channel;
  }

  publish(channel: string, data?: any) {
    this.outboundChannels.publish(channel, {data, type: MessageType.message});
  }

  listen = (port: number) => this.baseServer.listen(port);
  close = () => this.baseServer.close();

}