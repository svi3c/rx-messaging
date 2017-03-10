import "rxjs/add/operator/finally";
import proxyquire = require("proxyquire");
import { ClientConnector } from "./ClientConnector";
import * as sinon from "sinon";

describe("ClientConnector", () => {

  let RxSocket;
  let rxSocket;
  let connector: ClientConnector;
  let socket;
  let connectTcp;
  let connectTls;
  let clock;
  let ClientConnectorConstructor: typeof ClientConnector;

  beforeEach(() => {
    rxSocket = jasmine.createSpyObj("rxSocket", ["filter", "sendMessage"]);
    RxSocket = jasmine.createSpy("RxSocket").and.returnValue(rxSocket);
    socket = jasmine.createSpyObj("socket", ["on", "removeAllListeners"]);
    connectTcp = jasmine.createSpy("connect").and.returnValue(socket);
    connectTls = jasmine.createSpy("connect").and.returnValue(socket);
    clock = sinon.useFakeTimers();
    ClientConnectorConstructor = (proxyquire("./ClientConnector", {
      "net": { connect: connectTcp },
      "tls": { connect: connectTls }
    }) as { ClientConnector: typeof ClientConnector }).ClientConnector;
  });

  afterEach(() => {
    clock.restore();
  });

  describe("connect()", () => {

    it("should connect via tcp when no certificate is passed", () => {
      connector = new ClientConnectorConstructor({ port: 1234 });

      connector.connect();
      clock.tick();

      expect(connectTcp).toHaveBeenCalled();
    });

    it("should connect via tls when a certificate is passed", () => {
      connector = new ClientConnectorConstructor({ port: 1234, cert: "cert" });

      connector.connect();
      clock.tick();

      expect(connectTls).toHaveBeenCalled();
    });

    it("should reconnect if the connection closes", () => {
      connector = new ClientConnectorConstructor({ port: 1234 }, constantBackoff);
      connector.connect();
      clock.tick();

      socket.on.calls.argsFor(2)[1]();
      clock.tick(100);

      expect(connectTcp.calls.count()).toEqual(2);
    });

  });

  function* constantBackoff() {
    while (true) {
      yield 100;
    }
  }

});