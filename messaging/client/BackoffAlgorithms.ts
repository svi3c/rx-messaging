export type BackoffAlgorithm = () => Iterator<number>;

export interface IBackoffOptions {
  from?: number;
  to?: number;
}

const defaultBackoffOptions: IBackoffOptions = {
  from: 0,
  to: 5000
};

// Constant backoff

function *constantGenerator(constant: number) {
  while (true) {
    yield constant;
  }
}
/**
 * Generates a constant value.
 */
export const constant: (constant: number) => BackoffAlgorithm = constant =>
  () => constantGenerator(constant);

// Linear backoff

export interface ILinearBackoffOptions extends IBackoffOptions {
  factor?: number;
}

const defaultLinearReconnectOptions: ILinearBackoffOptions = {
  factor: 500
};

function *linearGenerator(opts?: ILinearBackoffOptions) {
  opts = Object.assign({}, defaultBackoffOptions, defaultLinearReconnectOptions, opts);
  let lastValue = opts.from;
  while (lastValue < opts.to) {
    yield lastValue;
    lastValue = lastValue + opts.factor;
  }
  while (true) {
    yield opts.to;
  }
}

/**
 * Generates values with a linear growth
 */
export const linear: (opts?: ILinearBackoffOptions) => BackoffAlgorithm = opts =>
  () => linearGenerator(opts);

// Exponential backoff

export interface IExponentialBackoffOptions extends IBackoffOptions {
  base?: number;
  factor?: number;
}

const defaultExponentialBackoffOptions: IExponentialBackoffOptions = {
  from: 1,
  base: 2,
  factor: 1
};

function *exponentialGenerator(opts?: IExponentialBackoffOptions) {
  opts = Object.assign({}, defaultBackoffOptions, defaultExponentialBackoffOptions, opts);
  let factorTimesBase = opts.factor;
  let lastValue = opts.from;
  while (lastValue < opts.to) {
    yield lastValue;
    factorTimesBase = factorTimesBase * opts.base;
    lastValue = factorTimesBase + opts.from - 1;
  }
  while (true) {
    yield opts.to;
  }
}

/**
 * Generates values with an exponential growth
 */
export const exponential: (opts?: IExponentialBackoffOptions) => BackoffAlgorithm = opts =>
  () => exponentialGenerator(opts);

// Random backoff

export interface IRandomBackoffOptions extends IBackoffOptions {
}

const defaultRandomBackoffOptions: IExponentialBackoffOptions = {};

function *randomGenerator(opts?: IRandomBackoffOptions) {
  opts = Object.assign({}, defaultBackoffOptions, defaultRandomBackoffOptions, opts);
  while (true) {
    yield Math.round(Math.random() * (opts.to - opts.from) + opts.from);
  }
}

/**
 * Generates random values
 */
export const random: (opts?: IExponentialBackoffOptions) => BackoffAlgorithm = opts =>
  () => randomGenerator(opts);