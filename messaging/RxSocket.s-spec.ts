import {RxSocket, MessageType, IMessage} from "./RxSocket";
import proxyquire = require("proxyquire");
import JsonSocket = require("json-socket");
import {it, invert} from "jasmine-promise-wrapper";
import {TypedError} from "./Error";

describe("RxSocket", () => {

  let socket: RxSocket;
  let jsonSocket: any;

  beforeEach(() => {
    let module = proxyquire("./RxSocket", {}) as {RxSocket: typeof RxSocket};
    jsonSocket = jasmine.createSpyObj("jsonSocket", ["on", "sendMessage"]);
    socket = new module.RxSocket(jsonSocket as JsonSocket);
  });

  describe("on('message')", () => {

    it("should parse incoming messages", () => {
      let message: IMessage;
      socket.messages$.subscribe(m => message = m);

      receiveMessage({
        t: MessageType.message,
        d: {foo: "bar"}
      });

      expect(message).toEqual(jasmine.objectContaining({
        type: MessageType.message,
        data: {foo: "bar"}
      }));
    });

  });

  describe("sendMessage()", () => {

    it("should serialize messages", () => {
      socket.send({
        type: MessageType.message,
        data: {foo: "bar"}
      });

      expect(jsonSocket.sendMessage).toHaveBeenCalledWith({
        t: MessageType.message,
        d: {foo: "bar"}
      }, jasmine.any(Function));
    });

    it("should resolve if no error occurs", () => {
      let promise = socket.send({
        type: MessageType.message,
        data: {foo: "bar"}
      });

      jsonSocket.sendMessage.calls.mostRecent().args[1]();

      return promise;
    });

    it("should reject if an error occurs", () => {
      let promise = socket.send({
        type: MessageType.message,
        data: {foo: "bar"}
      });

      jsonSocket.sendMessage.calls.mostRecent().args[1](new Error("foo"));

      return invert(promise).then(err => expect((err as any as Error).message).toEqual("foo"));
    });

    describe("errors", () => {

      let error = new TypedError("x", "foo");

      it("should call jsonSocket.sendMessage() with the given error", () => {
        socket.send({error: error, type: MessageType.message});

        expect(jsonSocket.sendMessage).toHaveBeenCalledWith({
          t: MessageType.message,
          e: {c: "x", m: "foo"}
        }, jasmine.any(Function));
      });

    });

  });

  function receiveMessage(message: any) {
    jsonSocket.on.calls.mostRecent().args[1](message);
  }

});