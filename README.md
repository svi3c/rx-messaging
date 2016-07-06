# rx-messaging

[![Build Status](https://travis-ci.org/svi3c/rx-messaging.svg?branch=master)](https://travis-ci.org/svi3c/rx-messaging)

A lightweight tcp/tls messaging protocol implementation based on rxjs.

### Example

```typescript
import {RxServer, RxClient} from "rx-messaging";

let server = new RxServer()
server.channel("my-channel").messages$
  .subscribe(msg => {
    console.log(msg.data);
    server.close();
  });
server.listen(12345);

let client = new RxClient({port: 12345});
client.connect();
client.send("my-channel", {foo: "bar"});
  .then(() => client.disconnect());
```