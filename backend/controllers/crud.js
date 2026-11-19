const db = require('../config/db');
const { clean, getEvent, isSafeUrl } = require('../utils/helpers');

// Generic admin CRUD for simple tables. Column names come from the whitelist below, values are always bound parameters.
module.exports = (table, { cols, required = [], order = 'id', urls = [], perEvent = true }) => {
  const pick = (body) => {
    const d = {};
    for (const c of cols) {
      if (!(c in body)) continue;
      let v = body[c];
      if (typeof v === 'boolean') v = v ? 1 : 0;
      v = clean(v);
      d[c] = v === '' || v === undefined ? null : v;
    }
    return d;
  };
  const problem = (d, partial) => {
    for (const k of required) if ((!partial || k in d) && d[k] == null) return `${k.replace(/_/g, ' ')} is required.`;
    for (const k of urls) if (d[k] != null && !isSafeUrl(d[k])) return `${k.replace(/_/g, ' ')} must be a full http(s) link or an uploaded file.`;
    return null;
  };

  return {
    list: async (req, res) => {
      const [rows] = await db.execute(`SELECT * FROM ${table} ORDER BY ${order}`);
      res.json(rows);
    },
    create: async (req, res) => {
      const d = pick(req.body);
      const err = problem(d, false);
      if (err) return res.status(400).json({ error: err });
      if (perEvent) d.event_id = (await getEvent()).id;
      const keys = Object.keys(d);
      const [r] = await db.execute(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, keys.map((k) => d[k]));
      res.status(201).json({ id: r.insertId });
    },
    update: async (req, res) => {
      const d = pick(req.body);
      const err = problem(d, true);
      if (err) return res.status(400).json({ error: err });
      const keys = Object.keys(d);
      if (!keys.length) return res.status(400).json({ error: 'Nothing to update.' });
      const [r] = await db.execute(`UPDATE ${table} SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`, [...keys.map((k) => d[k]), +req.params.id]);
      if (!r.affectedRows) return res.status(404).json({ error: 'Not found.' });
      res.json({ ok: true });
    },
    remove: async (req, res) => {
      const [r] = await db.execute(`DELETE FROM ${table} WHERE id=?`, [+req.params.id]);
      if (!r.affectedRows) return res.status(404).json({ error: 'Not found.' });
      res.json({ ok: true });
    },
  };
};
