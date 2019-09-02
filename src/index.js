import _ from 'lodash';
import Router from 'koa-router';
import koaBody from 'koa-body';
import shortId from 'shortid';

const router = Router();

function addTrace(config) {
  if (config && config.trace && config.trace.disabled) {
    return (ctx, next) => {
      return next();
    };
  }

  return async (ctx, next) => {
    let traceId = ctx.get('x-trace-id') || shortId();
    if (global.als) {
      global.als.set('traceId', traceId);
    }
    ctx.set('x-trace-id', traceId);
    await next();
  };
}

function addCatch() {
  return async (ctx, next) => {
    try {
      await next();
    }
    catch (err) {
      logger.warn(err);

      if (err instanceof Errors.OperationalError) {
        ctx.status = ctx.status === 404 ? 400 : ctx.status;
        ctx.body = err.response();
      }
      else {
        ctx.status = ctx.status === 404 ? 400 : ctx.status;
        ctx.body = new Errors.Unknown().response();
      }
    }
  };
}

function lift() {
  if (!global.Errors) {
    throw new Error('no global Errors found');
  }

  if (!global.logger) {
    throw new Error('no global logger found');
  }

  this.app.use(koaBody());

  _.forEach((this.config.http || {}).middlewares || [], (middleware) => {
    if (_.isFunction(middleware)) {
      this.app.use(middleware());
      return;
    }

    if (_.isArray(middleware)) {
      let middlewareArr = _.map(middleware, (arg) => {
        if (_.isFunction(arg)) {
          return arg();
        }
        return arg;
      });

      this.app.use(middlewareArr);
    }
  });

  _.forEach(this.config.routes, (action, key) => {
    let method;
    let pattern;
    let index = key.indexOf(' ');
    let allMethods = ['all', 'get', 'post', 'put', 'delete', 'patch'];

    if (index > -1) {
      let keyParts = [key.slice(0, index), key.slice(index + 1)];
      method = (keyParts[0] || '').toLowerCase();
      [, pattern] = keyParts;
    }
    else {
      method = 'all';
      pattern = key;
    }

    if (!_.includes(allMethods, method)) {
      throw new Error(`invalid route method: ${method}`);
    }

    if (_.isFunction(action)) {
      router[method](...[pattern].concat(action));
      return;
    }

    let actionParts = action.split('.');
    let controllerName = actionParts[0];
    let controller = this.controllers[controllerName];

    if (!controller) {
      throw new Error(`undefined controller: ${controllerName}`);
    }

    let actionMethodName = actionParts[1];
    let actionMethod = controller[actionMethodName].bind(controller);

    if (!actionMethod) {
      throw new Error(`undefined action method: ${action}`);
    }

    let wrapActionMethod = function wrapActionMethod(ctx, ...args) {
      return Promise.try(() => {
        return actionMethod(...[ctx, ...args]);
      }).then((data) => {
        if (!ctx.body) {
          ctx.body = data;
        }
        return data;
      });
    };

    let policies =
      (this.controllerActionPolicies &&
        this.controllerActionPolicies[`${controllerName}.${actionMethodName}`]) ||
      [];

    const funList = [pattern].concat(policies).concat(wrapActionMethod);
    router[method](...funList);
  });

  this.app.use(addTrace(this.config));
  this.app.use(addCatch());
  this.app.use(router.routes());
  this.app.use(router.allowedMethods());
}

export default lift;
