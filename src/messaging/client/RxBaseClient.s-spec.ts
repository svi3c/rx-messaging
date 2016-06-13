import "rxjs/add/operator/finally";
import {RxBaseClient} from "./RxBaseClient";
import proxyquire = require("proxyquire");

describe("RxBaseClient", () => {

  let RxSocket;
  let rxSocket;
  let client: RxBaseClient;
  let socket;
  let connectTcp;
  let connectTls;
  let RxBaseClientConstructor: typeof RxBaseClient;

  beforeEach(() => {
    rxSocket = jasmine.createSpyObj("rxSocket", ["filter", "sendMessage"]);
    RxSocket = jasmine.createSpy("RxSocket").and.returnValue(rxSocket);
    socket = jasmine.createSpyObj("socket", ["on"]);
    connectTcp = jasmine.createSpy("connect").and.returnValue(socket);
    connectTls = jasmine.createSpy("connect").and.returnValue(socket);
    RxBaseClientConstructor = (proxyquire("./RxBaseClient", {
      "./RxSocket": RxSocket,
      "net": {connect: connectTcp},
      "tls": {connect: connectTls}
    }) as {RxBaseClient: typeof RxBaseClient}).RxBaseClient;
  });

  describe("new()", () => {

    it("should immediately start connecting if options are provided", () => {
      client = new RxBaseClientConstructor({});

      expect(connectTcp).toHaveBeenCalled();
    });

    it("should not immediately start connecting if no options are provided", () => {
      client = new RxBaseClientConstructor();

      expect(connectTcp).not.toHaveBeenCalled();
    });

  });

  describe("connect()", () => {

    beforeEach(() => {
      client = new RxBaseClientConstructor();
    });

    it("should raise an error if no connection options are present", () => {
      expect(() => client.connect()).toThrowError("No connection options provided");
    });

    it("should connect via tcp when no certificate is passed", () => {
      client.connect({});

      expect(connectTcp).toHaveBeenCalled();
    });

    it("should connect via tls when a certificate is passed", () => {
      client.connect({cert: "foo"});

      expect(connectTls).toHaveBeenCalled();
    });

  });

});