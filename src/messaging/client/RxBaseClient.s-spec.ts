import "rxjs/add/operator/finally";
import { RxBaseClient } from "./RxBaseClient";
import proxyquire = require("proxyquire");
import { Subject } from "rxjs/Subject";

describe("RxBaseClient", () => {

  let RxSocket;
  let rxSocket;
  let ClientConnector;
  let clientConnector;
  let client: RxBaseClient;
  let socket;
  let connectTcp;
  let connectTls;
  let RxBaseClientConstructor: typeof RxBaseClient;

  beforeEach(() => {
    rxSocket = jasmine.createSpyObj("rxSocket", ["filter", "sendMessage"]);
    RxSocket = jasmine.createSpy("RxSocket").and.returnValue(rxSocket);
    clientConnector = jasmine.createSpyObj("clientConnector", ["connect", "disconnect"]);
    clientConnector.events$ = new Subject();
    ClientConnector = jasmine.createSpy("ClientConnector").and.returnValue(clientConnector);
    socket = jasmine.createSpyObj("socket", ["on"]);
    connectTcp = jasmine.createSpy("connect").and.returnValue(socket);
    connectTls = jasmine.createSpy("connect").and.returnValue(socket);
    RxBaseClientConstructor = (proxyquire("./RxBaseClient", {
      "./ClientConnector": { ClientConnector },
      "./RxSocket": RxSocket,
      "net": { connect: connectTcp },
      "tls": { connect: connectTls },
    }) as { RxBaseClient: typeof RxBaseClient }).RxBaseClient;
  });

  describe("new()", () => {

    it("should not immediately start connecting", () => {
      client = new RxBaseClientConstructor({ port: 1234 });

      expect(connectTcp).not.toHaveBeenCalled();
    });

  });

  describe("connect()", () => {

    it("should connect", () => {
      client = new RxBaseClientConstructor({ port: 1234 });

      client.connect();

      expect(clientConnector.connect).toHaveBeenCalled();
    });

  });

});
