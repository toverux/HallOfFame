import { describe, expect, it } from 'bun:test';
import { Glob } from 'bun';
import { listUnresolved } from './vanilla-modules';

const STUBS_DIRECTORY = `${import.meta.dir}/../vanilla-modules`;

describe('the vanilla module stubs', () => {
  it(`each resolve in the game's UI bundle`, async () => {
    const stubs = await Array.fromAsync(new Glob('**/*.ts').scan(STUBS_DIRECTORY));

    // A stub resolves on its first import, which may come from another test file: the failures of
    // every import so far are what tells.
    await Promise.all(stubs.map(stub => import(`${STUBS_DIRECTORY}/${stub}`)));

    // On a failure, the game moved or renamed what the stub names since an update: find it in the
    // readable bundle, then update the stub and its uses (the hof-game-update skill).
    expect(listUnresolved()).toEqual([]);
  });
});
