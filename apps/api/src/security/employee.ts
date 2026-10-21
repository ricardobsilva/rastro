import type { RequestHandler } from 'express';
import type { Db } from '../db/index.js';
import { HttpError } from '../http.js';
import { getEmployee } from '../repos/employees.js';
import { findDevice } from './device.js';

/** Exige aparelho autorizado com funcionário ativo identificado: `res.locals.employee`. */
export const requireEmployee =
  (db: Db): RequestHandler =>
  (req, res, next) => {
    const device = findDevice(db, req);
    if (!device) return next(new HttpError(401, 'Aparelho não autorizado.'));
    const emp = device.employee_id ? getEmployee(db, device.employee_id) : undefined;
    if (!emp || !emp.active) return next(new HttpError(401, 'Identifique-se para continuar.'));
    res.locals.device = device;
    res.locals.employee = emp;
    next();
  };
