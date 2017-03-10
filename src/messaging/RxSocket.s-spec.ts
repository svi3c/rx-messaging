import { IMessage, MessageType, RxSocket } from "./RxSocket";
import proxyquire = require("proxyquire");
import JsonSocket = require("json-socket");
import { invert, it } from "jasmine-promise-wrapper";
import { TypedError } from "./Error";

describe("RxSocket", () => {

  let socket: RxSocket;
  let jsonSocket: any;

  beforeEach(() => {
    let module = proxyquire("./RxSocket", {
      // tslint:disable-next-line: only-arrow-functions object-literal-shorthand
      "json-socket": function () {
        jsonSocket = jasmine.createSpyObj("jsonSocket", ["on", "sendMessage"]);
        return jsonSocket;
      },
    }) as { RxSocket: typeof RxSocket };
    socket = new module.RxSocket(null);
  });

  describe("on('message')", () => {

    it("should parse incoming messages", () => {
      let message: IMessage;
      socket.messages$.subscribe((m) => message = m);

      receiveMessage({
        d: { foo: "bar" },
        t: MessageType.message,
      });

      expect(message).toEqual(jasmine.objectContaining({
        data: { foo: "bar" },
        type: MessageType.message,
      }));
    });

  });

  describe("sendMessage()", () => {

    it("should serialize messages", () => {
      socket.send({
        data: { foo: "bar" },
        type: MessageType.message,
      });

      expect(jsonSocket.sendMessage).toHaveBeenCalledWith({
        d: { foo: "bar" },
        t: MessageType.message,
      }, jasmine.any(Function));
    });

    it("should resolve if no error occurs", () => {
      let promise = socket.send({
        data: { foo: "bar" },
        type: MessageType.message,
      });

      jsonSocket.sendMessage.calls.mostRecent().args[1]();

      return promise;
    });

    it("should reject if an error occurs", () => {
      let promise = socket.send({
        data: { foo: "bar" },
        type: MessageType.message,
      });

      jsonSocket.sendMessage.calls.mostRecent().args[1](new Error("foo"));

      return invert(promise).then((err) => expect((err as any as Error).message).toEqual("foo"));
    });

    describe("errors", () => {

      let error = new TypedError("x", "foo");

      it("should call jsonSocket.sendMessage() with the given error", () => {
        socket.send({ error, type: MessageType.message });

        expect(jsonSocket.sendMessage).toHaveBeenCalledWith({
          e: { c: "x", m: "foo" },
          t: MessageType.message,
        }, jasmine.any(Function));
      });

    });

  });

  function receiveMessage(message: any) {
    jsonSocket.on.calls.first().args[1](message);
  }

});
