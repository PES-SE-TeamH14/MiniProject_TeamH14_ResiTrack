const fs = require('fs');
const path = require('path');

/**
 * NFR-09 (#29): automated MVC architecture review.
 * Reads every file under src/ and checks which layers it depends on, so a change that breaks
 * the layering (e.g. a route querying a model directly) fails CI instead of slipping through review.
 *
 *   routes/       URL -> controller. May use controllers, middleware, utils. Never models.
 *   controllers/  Request handling. May use models, services, utils. Never routes or other controllers.
 *   models/       Mongoose schemas. Never controllers, routes, services, middleware or Express.
 *   services/     Business jobs (reminders, receipts). Never controllers or routes.
 *   middleware/   Cross-cutting request checks. Never controllers or routes.
 *   utils/        Helpers. Never controllers or routes.
 */
const SRC = path.join(__dirname, '..', 'src');
const LAYERS = ['routes', 'controllers', 'models', 'services', 'middleware', 'utils', 'config'];

const RULES = {
  routes: ['models', 'services'],
  controllers: ['routes', 'controllers'],
  models: ['controllers', 'routes', 'services', 'middleware'],
  services: ['controllers', 'routes'],
  middleware: ['controllers', 'routes'],
  utils: ['controllers', 'routes', 'middleware'],
  config: ['controllers', 'routes', 'models', 'services', 'middleware'],
};

function filesIn(layer) {
  const dir = path.join(SRC, layer);
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => path.join(dir, name));
}

/** Layer names this file requires, e.g. ['models', 'utils']; './sibling' counts as its own layer. */
function requiredLayers(file) {
  const ownLayer = path.basename(path.dirname(file));
  const source = fs.readFileSync(file, 'utf8');
  const targets = [...source.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
  return targets
    .filter((t) => t.startsWith('.'))
    .map((t) => {
      const resolved = path.resolve(path.dirname(file), t);
      const relative = path.relative(SRC, resolved).split(path.sep);
      return relative.length > 1 ? relative[0] : ownLayer;
    });
}

function packages(file) {
  const source = fs.readFileSync(file, 'utf8');
  return [...source.matchAll(/require\(\s*['"]([^'".][^'"]*)['"]\s*\)/g)].map((m) => m[1]);
}

describe('MVC layering (NFR-09, TC-NFR-09)', () => {
  it('has a folder for each MVC layer', () => {
    for (const layer of LAYERS) {
      expect(fs.existsSync(path.join(SRC, layer))).toBe(true);
    }
  });

  describe.each(Object.entries(RULES))('%s/', (layer, forbidden) => {
    it.each(filesIn(layer).map((f) => [path.basename(f), f]))(`%s does not depend on ${forbidden.join(', ')}`, (_name, file) => {
      // A sibling require ('./x') counts as the file's own layer, so controller -> controller is caught too
      const offending = requiredLayers(file).filter((dep) => forbidden.includes(dep));
      expect(offending).toEqual([]);
    });
  });

  it('keeps Express out of models and controllers', () => {
    const files = [...filesIn('models'), ...filesIn('controllers')];
    const withExpress = files.filter((f) => packages(f).includes('express')).map((f) => path.basename(f));
    expect(withExpress).toEqual([]);
  });

  it('gives every route file a matching controller', () => {
    const routeModules = filesIn('routes')
      .map((f) => path.basename(f, '.js'))
      .filter((name) => name !== 'index');
    const controllers = new Set(filesIn('controllers').map((f) => path.basename(f, '.js')));

    for (const route of routeModules) {
      expect(controllers).toContain(route.replace(/Routes$/, 'Controller'));
    }
  });

  it('mounts every route file in routes/index.js', () => {
    const index = fs.readFileSync(path.join(SRC, 'routes', 'index.js'), 'utf8');
    const routeModules = filesIn('routes')
      .map((f) => path.basename(f, '.js'))
      .filter((name) => name !== 'index');

    for (const route of routeModules) {
      expect(index).toContain(`require('./${route}')`);
    }
  });
});
