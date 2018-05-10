import _ from 'lodash';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

const router = Router();

function lift() {
  this.app.use(bodyParser());
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

    if ({}.toString.call(actionMethod) !== '[object AsyncFunction]') {
      throw new Error('controller function need be async');
    }

    let wrapActionMethod = function wrapActionMethod(ctx, ...args) {
      return actionMethod(...[ctx, ...args])
        .then((data) => {
          if (!ctx.body) {
            ctx.body = data;
          }
          return data;
        })
        .catch((err) => {
          global.logger.warn(err);
          ctx.status = ctx.status || 400;
        });
    };

    let policies =
      (this.controllerActionPolicies &&
        this.controllerActionPolicies[`${controllerName}.${actionMethodName}`]) ||
      [];

    router[method](...[pattern].concat(policies).concat(wrapActionMethod));
  });

  this.app.use(router.routes());
  this.app.use(router.allowedMethods());
}

export default lift;
