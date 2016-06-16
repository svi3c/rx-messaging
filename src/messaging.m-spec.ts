import {
  beforeEach,
  afterEach,
  it,
  await
} from "jasmine-await";
import {RxServer, RxClient} from "./messaging";
import {Observable} from "rxjs/Observable";
import {MessageType, IMessage, IRequest, IResponse} from "./messaging/RxSocket";

describe("channeledMessaging", () => {

  let server: RxServer;
  let client: RxClient;

  beforeEach(() => {
    server = new RxServer();
    await(server.listen(11115));
    await(new Promise<void>(resolve => {
      client = new RxClient({port: 11115, host: "localhost"});
      client.on("connect", resolve);
    }));
  });

  afterEach(() =>
    client.disconnect()
      .then(server.close));

  describe("fire and forget", () => {

    it("should be received by the server", () => {
      let promise = server.channel("foo").messages$.take(1).toPromise();

      await(client.send("foo", "bar"));
      let message = await(promise);

      expect(message.channel).toEqual("foo");
      expect(message.data).toEqual("bar");
      expect(message.type).toEqual(MessageType.message);
    });

  });

  describe("request and respond", () => {

    it("should be processed by client and server", () => {
      let requestPromise = server.channel("foo").requests$.take(1).toPromise();
      requestPromise.then(req => req.respond("baz"));

      let x = await([requestPromise, client.request("foo", "bar").toPromise()]) as any[];
      let request = x[0] as IRequest;
      let response = x[1] as IResponse;

      expect(request.channel).toEqual("foo");
      expect(request.data).toEqual("bar");
      expect(request.type).toEqual(MessageType.request);
      expect(response.channel).toEqual("foo");
      expect(response.data).toEqual("baz");
      expect(response.type).toEqual(MessageType.response);
    });

  });

  describe("pub sub", () => {

    it("should publish messages on a given channel", () => {
      let channel$ = await(client.subscribe("foo")) as Observable<IMessage>;
      let promise = channel$.take(1).toPromise();
      server.publish("foo", "bar");

      let message = await(promise);

      expect(message.channel).toEqual("foo");
      expect(message.data).toEqual("bar");
    });

  });

});