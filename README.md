# Description

wrapper around the backend  
this wrapper will handle backend api auth for you  
  
default header behavior is :   
 - fwd user agent  
 - fwd user ip  
 - fwd content type  

# Usage

## create client

```
var Client = require('afrostream-node-client-backend');
var client = new Client({
  apiKey: "42424242",
  apiSecret: "42424242"
});
```

## request the backend api

```
client.get('/api/movies')
  .then(
  function success(body) {
    res.json(body);
  },
  function (error) {
    res.status(error.statusCode).json({error: error.message});
  });
client.get('/auth/geo').then(...);
client.post('...');
client.put('...');
client.delete('...');
```

you can overwrite the oauth bearer token using options

```
client.get('/api/movies', { token: '42424242' }).then(function success(body) { });
```

you can overwrite request options using options 

```
client.get('/api/movies', { method: 'POST' }).then(...);
```

## request backend fwding input req infos

```
client.get('/api/movies', { req: req }).then(...); // will add x-forwarded-user-ip & content-type header
```

## request backend without auth

```
client.get('/api/movies', { token: null }).then(...);
```

## proxy requests to the backend

```
client.proxy(req, res);
```

## fwd response

```
client.get('/api/movies').nodeify(client.fwd(res));
```

## low level requests

```
client.request({uri:'/api/movies'}).then(function (data) {
    var response = data[0];
    var body = data[1];
}, function (err) {
    // network errors.
    console.error(err.message);
});
```

## high level requests

```
client.custom({uri: '/api/movies'}).then(function (body) {
    // only 200OK responses
    console.log(body)
}, function (err) {
    // 403, 500, ... errors + network errors
    res.status(err.statusCode).json({error: err.message});
    console.error(err.message);
});
```