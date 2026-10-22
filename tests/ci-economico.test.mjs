// El CI corre cuando hay algo que publicar, no con cada push.
//
// POR QUE EXISTE. En septiembre de 2026 los repositorios privados del operador gastaron 2.573
// minutos de GitHub Actions; el tope de USD 2 se paso el 17-09 y trabo el CI de otro proyecto, y el
// 06-10 un push a main quedo bloqueado por facturacion. Un push por fase o por arreglo es una
// corrida por fase o por arreglo. Este repositorio es publico y ahi Actions no cobra, pero su
// flujo y el que el protocolo le arma a cada proyecto (skills/subagent-chore.md, Task D) son el
// molde que el agente copia en repositorios que si pagan.
//
// QUE FIJA, en los dos flujos: `push` solo a main, PR y disparo manual; `concurrency` que cancela
// corridas viejas de un PR pero NUNCA una de main (un commit de main cancelado puede terminar
// etiquetado sin CI); y una sola corrida completa de la suite por trabajo. El de proyectos corre en
// un solo sistema operativo.
//
// LO QUE NO CUBRE: cuantas veces se pushea. El reflog del remoto registra fetch y no push, y un hook
// se saltea con --no-verify; eso lo dice LAW 9 de SKILL.md y el menu de 8.1, no un gate.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de IA Stack, no del proyecto de quien instala' }
  : {};

/** Las lineas que se ejecutan, sin comentarios. */
export function lineasEjecutables(yaml) {
  return yaml.split('\n').filter((linea) => !/^\s*#/u.test(linea));
}

/** Cuantas corridas COMPLETAS de la suite hay: `node --test` sin un archivo de pruebas detras. */
export function corridasDeLaSuite(yaml) {
  return lineasEjecutables(yaml).filter((linea) => /node --test(?!\s+\S*tests\/)/u.test(linea)).length;
}

/** Los disparadores y la concurrencia que todo flujo del protocolo tiene que declarar. */
export function problemasDeDisparo(yaml) {
  const texto = lineasEjecutables(yaml).join('\n');
  const problemas = [];
  if (!/^on:\s*$/mu.test(texto)) problemas.push('falta el bloque on:');
  if (!/^\s+push:\s*\n\s+branches:\s*\[\s*main\s*\]/mu.test(texto)) problemas.push('push sin filtro a main');
  if (!/^\s+pull_request:/mu.test(texto)) problemas.push('falta pull_request');
  if (!/^\s+workflow_dispatch:/mu.test(texto)) problemas.push('falta workflow_dispatch');
  if (!/^concurrency:\s*\n\s+group:\s*\S+/mu.test(texto)) problemas.push('falta concurrency con group');
  if (!/cancel-in-progress:\s*\$\{\{\s*github\.event_name\s*==\s*'pull_request'\s*\}\}/u.test(texto)) problemas.push('cancel-in-progress tiene que valer solo para PR');
  return problemas;
}

/** El YAML que Task D le arma a un proyecto, tal como esta escrito en el skill. */
export function yamlDeTaskD(markdown) {
  return /<!-- ci-proyecto:inicio -->\s*```ya?ml\n([\s\S]*?)```\s*<!-- ci-proyecto:fin -->/u.exec(markdown)?.[1] ?? null;
}

test('las funciones de lectura distinguen la suite completa de un archivo suelto y los comentarios', () => {
  assert.equal(corridasDeLaSuite('# node --test\n      - run: node --test\n      run: node --test tests/a.test.mjs\n'), 1);
  assert.deepEqual(problemasDeDisparo('on:\n  push:\n'), ['push sin filtro a main', 'falta pull_request', 'falta workflow_dispatch', 'falta concurrency con group', 'cancel-in-progress tiene que valer solo para PR']);
  assert.equal(yamlDeTaskD('nada'), null);
});

test('el CI de este repositorio corre en main, PR y a mano, sin cancelar main', SOLO_FUENTE, () => {
  const yaml = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  assert.deepEqual(problemasDeDisparo(yaml), []);
});

test('el CI de este repositorio corre la suite una sola vez por sistema operativo', SOLO_FUENTE, () => {
  const yaml = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  assert.equal(corridasDeLaSuite(yaml), 1, 'la corrida con cobertura ya es la suite completa y propaga el rojo');
  assert.match(yaml, /os:\s*\[ubuntu-latest, windows-latest\]/u, 'la union de cobertura necesita los dos sistemas');
});

test('el flujo que el protocolo arma para un proyecto es economico: main, PR, un solo sistema, una corrida', () => {
  const ruta = join(repoRoot, 'skills/subagent-chore.md');
  assert.ok(existsSync(ruta));
  const yaml = yamlDeTaskD(readFileSync(ruta, 'utf8'));
  assert.ok(yaml, 'skills/subagent-chore.md no delimita el YAML con <!-- ci-proyecto:inicio --> / <!-- ci-proyecto:fin -->');
  assert.deepEqual(problemasDeDisparo(yaml), []);
  assert.doesNotMatch(yaml, /windows-latest|macos-latest|matrix:/u, 'un proyecto arranca con un solo sistema operativo');
});
