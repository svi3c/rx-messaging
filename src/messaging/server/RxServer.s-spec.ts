import { RxServer } from "./RxServer";
import proxyquire = require("proxyquire");
import { Subject } from "rxjs/Subject";
import { MessageType } from "../RxSocket";
import { RxBaseServer } from "./RxBaseServer";

describe("RxServer", () => {

  let messages$: Subject<any>;
  let requests$: Subject<any>;
  let subscribes$: Subject<any>;
  let unsubscribes$: Subject<any>;
  let server: RxServer;

  beforeEach(() => {
    let module = proxyquire("./RxServer", {}) as { RxServer: typeof RxServer };
    messages$ = new Subject();
    requests$ = new Subject();
    subscribes$ = new Subject();
    unsubscribes$ = new Subject();
    server = new module.RxServer({ messages$, requests$, subscribes$, unsubscribes$ } as any as RxBaseServer);
  });

  describe("channel()", () => {

    it("should correctly channel the messages", () => {
      let fooMessage;
      let barMessage;
      let bazMessage;
      server.channel("foo").messages$.subscribe((m) => fooMessage = m);
      server.channel("bar").messages$.subscribe((m) => barMessage = m);
      server.channel("baz").messages$.subscribe((m) => bazMessage = m);

      messages$.next({ channel: "foo", data: "foo" });
      messages$.next({ channel: "bar", data: "bar" });
      messages$.next({ channel: "baz", data: "baz" });

      expect(fooMessage.data).toEqual("foo");
      expect(barMessage.data).toEqual("bar");
      expect(bazMessage.data).toEqual("baz");
    });

  });

  describe("publish()", () => {

    let socket: any;
    let respond: any;

    beforeEach(() => {
      socket = jasmine.createSpyObj("socket", ["send", "on"]);
      respond = jasmine.createSpy("respond");
      subscribes$.next({ channel: "foo", socket, respond });
    });

    it("should publish a message to subscribed clients", () => {
      server.publish("foo", { bar: "baz" });

      expect(socket.send).toHaveBeenCalledWith({ channel: "foo", data: { bar: "baz" }, type: MessageType.message });
    });

    it("should not publish messages to unsubscribed clients", () => {
      unsubscribes$.next({ channel: "foo", socket, respond });

      server.publish("foo", { bar: "baz" });

      expect(socket.send).not.toHaveBeenCalled();
    });

  });

});
