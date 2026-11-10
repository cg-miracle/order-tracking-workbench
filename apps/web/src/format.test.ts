import { expect, it } from 'vitest';
import { formatDateTime } from './format';

it('澳大利亚日期按日月年显示，时间使用 Sydney 时区并处理夏令时', () => {
  const summer = formatDateTime('2025-02-13T00:49:59Z');
  const winter = formatDateTime('2025-07-13T00:49:59Z');

  expect(summer).toContain('13 Feb 2025');
  expect(summer).toMatch(/11:49/);
  expect(summer).toMatch(/AEDT|GMT[+]11/);
  expect(winter).toMatch(/10:49/);
  expect(winter).toMatch(/AEST|GMT[+]10/);
});
