import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generarHash, generarHmac, generarHashEntrada, normalizarParaHash, HASH_GENESIS } from '../src/utils/hash.js';
import { cifrar, descifrar, hashCURP, hashPassword, verificarPassword } from '../src/utils/crypto.js';

describe('utils/hash', () => {
  it('normaliza Date, null y numeros de forma deterministica', () => {
    const fecha = new Date('2026-10-15T07:22:01.099Z');
    assert.equal(normalizarParaHash(fecha), '2026-10-15T07:22:01.099Z');
    assert.equal(normalizarParaHash(null), '');
    assert.equal(normalizarParaHash(undefined), '');
    assert.equal(normalizarParaHash(5), '5');
  });

  it('el hash de entrada no cambia entre tipos JS y tipos leidos de PostgreSQL', () => {
    const fecha = new Date('2026-10-15T07:22:01.099Z');
    const alInsertar = generarHashEntrada(['abc', fecha.toISOString(), 'O+', 1, 'sur'], HASH_GENESIS);
    const alLeer = generarHashEntrada(['abc', fecha, 'O+', '1', 'sur'], HASH_GENESIS);
    assert.equal(alInsertar, alLeer);
  });

  it('el hash de entrada depende del hash anterior', () => {
    const valores = ['abc', 'O+', 1];
    assert.notEqual(generarHashEntrada(valores, HASH_GENESIS), generarHashEntrada(valores, 'f'.repeat(64)));
  });

  it('HMAC es deterministico y distinto al SHA-256 simple', () => {
    assert.equal(generarHmac('dato'), generarHmac('dato'));
    assert.notEqual(generarHmac('dato'), generarHash('dato'));
    assert.match(generarHmac('dato'), /^[0-9a-f]{64}$/);
  });
});

describe('utils/crypto', () => {
  it('cifra y descifra con IV aleatorio', () => {
    const a = cifrar('Juan Perez');
    const b = cifrar('Juan Perez');
    assert.notEqual(a, b);
    assert.equal(descifrar(a), 'Juan Perez');
    assert.equal(descifrar(b), 'Juan Perez');
  });

  it('cifrar regresa null con valores vacios', () => {
    assert.equal(cifrar(null), null);
    assert.equal(cifrar(''), null);
    assert.equal(descifrar(null), null);
  });

  it('hashCURP ignora mayusculas y espacios', () => {
    assert.equal(hashCURP(' oifc000101hbsllra1 '), hashCURP('OIFC000101HBSLLRA1'));
  });

  it('bcrypt verifica la contrasena correcta y rechaza la incorrecta', async () => {
    const hash = await hashPassword('MiPassword123');
    assert.equal(await verificarPassword('MiPassword123', hash), true);
    assert.equal(await verificarPassword('otra', hash), false);
  });
});
