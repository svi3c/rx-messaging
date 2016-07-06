import "rxjs/add/operator/finally";
import {RxBaseServer} from "./RxBaseServer";
import * as proxyquire from "proxyquire";
import {IMessage, MessageType} from "../RxSocket";
import {Subject} from "rxjs/Rx";

describe("RxBaseServer", () => {

  let server;
  let JsonSocket;
  let rxBaseServer: RxBaseServer;
  let messages$: Subject<IMessage>;
  let message: IMessage;

  beforeEach(() => {
    server = jasmine.createSpyObj("server", ["listen", "on"]);
    JsonSocket = jasmine.createSpy("JsonSocket");
    messages$ = new Subject<IMessage>();
    let rxSocket = {
      messages$
    } as any;
    let module = proxyquire("./RxBaseServer", {
      "json-socket": JsonSocket,
      "../RxSocket": {
        RxSocket: function () {
          return rxSocket;
        }
      }
    }) as {RxBaseServer: typeof RxBaseServer};
    rxBaseServer = new module.RxBaseServer(server);
    connect();
    message = null;
  });

  it("should emit the message if the server retrieves it", () => {
    rxBaseServer.messages$.subscribe(m => message = m);

    sendMessage({data: "foo", type: MessageType.message});

    expect(message.data).toEqual("foo");
    expect(message.type).toEqual(MessageType.message);
  });

  it("should emit the request if the server retrieves it", () => {
    rxBaseServer.requests$.subscribe(m => message = m);

    sendMessage({data: "foo", type: MessageType.request});

    expect(message.data).toEqual("foo");
    expect(message.type).toEqual(MessageType.request);
  });

  it("should emit the subscription if the server retrieves it", () => {
    rxBaseServer.subscribes$.subscribe(m => message = m);

    sendMessage({type: MessageType.subscribe});

    expect(message.type).toEqual(MessageType.subscribe);
  });

  it("should emit the unsubscription if the server retrieves it", () => {
    rxBaseServer.unsubscribes$.subscribe(m => message = m);

    sendMessage({type: MessageType.unsubscribe});

    expect(message.type).toEqual(MessageType.unsubscribe);
  });

  function connect() {
    server.on.calls.mostRecent().args[1]();
  }

  function sendMessage(message: IMessage) {
    messages$.next(message);
  }

});