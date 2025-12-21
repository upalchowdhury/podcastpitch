import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        'types/index': 'src/types/index.ts',
        'schemas/index': 'src/schemas/index.ts',
        'constants/index': 'src/constants/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    splitting: false,
});
