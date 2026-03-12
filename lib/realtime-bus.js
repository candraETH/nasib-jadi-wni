const { EventEmitter } = require('events');
const { createClient } = require('redis');

const CHANNEL = 'njw:events';

const globalState = globalThis;
if (!globalState.__NJW_REALTIME_BUS__) {
  globalState.__NJW_REALTIME_BUS__ = {
    emitter: new EventEmitter(),
    handlers: new Set(),
    publisher: null,
    subscriber: null,
    redisReady: false,
    redisUrl: process.env.REDIS_URL || '',
  };
}

const state = globalState.__NJW_REALTIME_BUS__;

async function ensurePublisher() {
  if (!state.redisUrl) return null;
  if (state.publisher) return state.publisher;
  const client = createClient({ url: state.redisUrl });
  client.on('error', (err) => console.error('Redis publish error:', err));
  await client.connect();
  state.publisher = client;
  return client;
}

async function ensureSubscriber() {
  if (!state.redisUrl) return null;
  if (state.subscriber) return state.subscriber;
  const client = createClient({ url: state.redisUrl });
  client.on('error', (err) => console.error('Redis subscribe error:', err));
  await client.connect();
  await client.subscribe(CHANNEL, (message) => {
    for (const handler of state.handlers) {
      handler(message);
    }
  });
  state.subscriber = client;
  return client;
}

async function publishEvent(event) {
  const payload = JSON.stringify(event);
  try {
    const publisher = await ensurePublisher();
    if (publisher) {
      await publisher.publish(CHANNEL, payload);
      return;
    }
  } catch (error) {
    console.error('Realtime publish failed:', error);
  }
  state.emitter.emit(CHANNEL, payload);
}

function subscribeEvents(handler) {
  state.handlers.add(handler);
  if (state.redisUrl) {
    ensureSubscriber().catch((error) =>
      console.error('Realtime subscribe failed:', error)
    );
  } else {
    state.emitter.on(CHANNEL, handler);
  }

  return () => {
    state.handlers.delete(handler);
    if (!state.redisUrl) {
      state.emitter.off(CHANNEL, handler);
    }
  };
}

module.exports = {
  publishEvent,
  subscribeEvents,
};
