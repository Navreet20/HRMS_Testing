# Frontend tests

| Folder | Purpose | Run |
|--------|---------|-----|
| `unit/` | Pure selectors/reducers/validation/utils | `npm run test:unit` |
| `functional/` | Module/component feature behavior | `npm run test:functional` |
| `regression/` | App integrations + route/contract locks | `npm run test:regression` |
| `support/` | Shared fixtures and stubs (not tests) | — |

All:

```bash
npm test
```
