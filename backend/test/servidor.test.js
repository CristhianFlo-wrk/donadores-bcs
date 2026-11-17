import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';

test('el servidor termina con error si el puerto esta ocupado', async () => {
  const ocupante = net.createServer();
  await new Promise((resolver) => ocupante.listen(0, resolver));
  const puerto = ocupante.address().port;

  try {
    const hijo = spawn(process.execPath, ['src/index.js'], {
      env: { ...process.env, NODE_ENV: 'development', PORT: String(puerto) }
    });
    let salidaError = '';
    let salida = '';
    hijo.stderr.on('data', (trozo) => { salidaError += trozo; });
    hijo.stdout.on('data', (trozo) => { salida += trozo; });
    const codigo = await new Promise((resolver) => hijo.on('exit', resolver));

    assert.equal(codigo, 1);
    assert.match(salidaError, /No se pudo abrir el puerto/);
    assert.doesNotMatch(salida, /Servidor corriendo/);
  } finally {
    ocupante.close();
  }
});
