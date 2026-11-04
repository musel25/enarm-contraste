import { HttpError } from "./http";

type Budget = {
  minute: number;
  requests: number;
  hour: number;
  accounts: number;
  profiles: number;
};

/** Counters are reserved synchronously, before an asynchronous operation starts. */
export function createRateLimits(requestLimit: number, createLimit: number) {
  const budgets = new Map<string, Budget>();

  function budget(ip: string): Budget {
    const minute = Math.floor(Date.now() / 60_000),
      hour = Math.floor(minute / 60);
    if (!budgets.has(ip) && budgets.size >= 10_000) {
      for (const [key, value] of budgets) if (value.hour !== hour) budgets.delete(key);
      if (budgets.size >= 10_000) throw new HttpError(429, "Inténtalo más tarde.");
    }
    const value = budgets.get(ip) ?? { minute, requests: 0, hour, accounts: 0, profiles: 0 };
    if (value.minute !== minute) {
      value.minute = minute;
      value.requests = 0;
    }
    if (value.hour !== hour) {
      value.hour = hour;
      value.accounts = 0;
      value.profiles = 0;
    }
    budgets.set(ip, value);
    return value;
  }

  return {
    request(ip: string) {
      if (++budget(ip).requests > requestLimit)
        throw new HttpError(429, "Demasiadas solicitudes. Inténtalo más tarde.");
    },
    createAccount(ip: string) {
      if (++budget(ip).accounts > createLimit)
        throw new HttpError(429, "Demasiadas cuentas nuevas. Inténtalo más tarde.");
    },
    createProfile(ip: string) {
      if (++budget(ip).profiles > createLimit)
        throw new HttpError(429, "Demasiados perfiles nuevos. Inténtalo más tarde.");
    },
  };
}
