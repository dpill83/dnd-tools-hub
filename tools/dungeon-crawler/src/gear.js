/** Run-specific gear (gives the run identity). */

let hasShield = false; // +1 permanent armor (reduces all enemy damage)
let hasRing = false; // extends torch duration per ignited torch

export function resetGearForRun() {
  hasShield = false;
  hasRing = false;
}

export function equipShield() {
  hasShield = true;
}

export function equipRing() {
  hasRing = true;
}

export function getPermanentArmorBonus() {
  return hasShield ? 1 : 0;
}

export function getTorchDurationBonusTurnsPerIgnite() {
  // Modest so it changes playstyle without trivializing torch management.
  return hasRing ? 12 : 0;
}

export function getHasShield() {
  return hasShield;
}

export function getHasRing() {
  return hasRing;
}

