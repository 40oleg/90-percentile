import { Page, expect, test } from '@playwright/test';

const ATTEMPTS_KEY = '90percentile.quiz.attempts';
const SESSION_KEY = '90percentile.quiz.session';
const VIEW_KEY = '90percentile.view';

interface SeedAttempt {
  id: string;
  topicId: string;
  correct: number;
  total: number;
  at: string;
}

function attempts(count: number, correctOf: (i: number) => number): SeedAttempt[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `seed-${i}`,
    topicId: 'angular',
    correct: correctOf(i),
    total: 15,
    // Oldest first in time, so the newest attempt is the last one seeded.
    at: new Date(2026, 0, 1, 0, i).toISOString(),
  }));
}

async function seed(page: Page, history: SeedAttempt[]): Promise<void> {
  await page.addInitScript(
    ([key, viewKey, payload]) => {
      localStorage.setItem(key as string, payload as string);
      localStorage.setItem(viewKey as string, 'quiz');
    },
    [ATTEMPTS_KEY, VIEW_KEY, JSON.stringify([...history].reverse())] as const,
  );
}

async function openQuiz(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('.nav-btn', { hasText: 'ТЕСТ' }).click();
}

/**
 * Reads the right option straight out of the stored run. Waits until the stored
 * question is an unanswered one, so it can never read the state of the question
 * the user has just left.
 */
async function correctIndex(page: Page): Promise<number> {
  const handle = await page.waitForFunction((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    const question = stored.questions?.[stored.index];
    return question && question.answeredIndex === null
      ? { correctIndex: question.correctIndex as number }
      : null;
  }, SESSION_KEY);

  return (await handle.jsonValue()).correctIndex;
}

async function answer(page: Page, correctly: boolean): Promise<void> {
  const correct = await correctIndex(page);
  const pick = correctly ? correct : (correct + 1) % 4;
  await page.locator('.option').nth(pick).click();
  await page.locator('.next-btn').click();
}

/** Plays a full 15-question run with `correct` right answers. */
async function playRun(page: Page, correct: number): Promise<void> {
  for (let i = 0; i < 15; i++) await answer(page, i < correct);
}

function stat(page: Page, index: number) {
  return page.locator('.qstat-value').nth(index);
}

test.describe('quiz section', () => {
  test('the menu opens the quiz section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card')).toHaveCount(25);

    await page.locator('.nav-btn', { hasText: 'ТЕСТ' }).click();

    await expect(page.locator('.topic')).toHaveCount(3);
    await expect(page.locator('.card')).toHaveCount(0);
    await expect(page.locator('.start-btn')).toContainText('15 ВОПРОСОВ');
  });

  test('starts empty with no attempts and an empty chart', async ({ page }) => {
    await openQuiz(page);

    await expect(stat(page, 0)).toHaveText('0');
    await expect(stat(page, 1)).toHaveText('—');
    await expect(page.locator('.chart-empty')).toBeVisible();
    await expect(page.locator('.topic-best').first()).toHaveText('НЕ СДАВАЛСЯ');
    await expect(page.locator('.reset-btn')).toHaveCount(0);
  });

  test('a run asks 15 questions with four options each', async ({ page }) => {
    await openQuiz(page);
    await page.locator('.start-btn').click();

    await expect(page.locator('.runner-step')).toHaveText('ВОПРОС 1/15');
    await expect(page.locator('.option')).toHaveCount(4);
    await expect(page.locator('.segment')).toHaveCount(15);
    await expect(page.locator('.prompt')).not.toBeEmpty();
  });

  test('answering reveals the right option and an explanation', async ({ page }) => {
    await openQuiz(page);
    await page.locator('.start-btn').click();

    const correct = await correctIndex(page);
    await page
      .locator('.option')
      .nth((correct + 1) % 4)
      .click();

    await expect(page.locator('.option.correct')).toHaveCount(1);
    await expect(page.locator('.option.wrong')).toHaveCount(1);
    await expect(page.locator('.feedback-title')).toHaveText('НЕВЕРНО');
    await expect(page.locator('.feedback-text')).not.toBeEmpty();
    await expect(page.locator('.next-btn')).toBeVisible();
  });

  test('a right answer is confirmed and counted', async ({ page }) => {
    await openQuiz(page);
    await page.locator('.start-btn').click();

    await page
      .locator('.option')
      .nth(await correctIndex(page))
      .click();

    await expect(page.locator('.feedback-title')).toHaveText('ВЕРНО');
    await expect(page.locator('.runner-score')).toContainText('1');
  });

  test('the last question offers the result instead of the next one', async ({ page }) => {
    await openQuiz(page);
    await page.locator('.start-btn').click();
    for (let i = 0; i < 14; i++) await answer(page, true);

    await expect(page.locator('.runner-step')).toHaveText('ВОПРОС 15/15');
    await page
      .locator('.option')
      .nth(await correctIndex(page))
      .click();
    await expect(page.locator('.next-btn')).toHaveText('РЕЗУЛЬТАТ');
  });

  test('finishing a run shows the score and charts it', async ({ page }) => {
    await openQuiz(page);
    await page.locator('.start-btn').click();
    await playRun(page, 12);

    await expect(page.locator('.score-value')).toHaveText('80%');
    await expect(page.locator('.score-detail')).toHaveText('12 / 15 ВЕРНО');
    await expect(page.locator('.miss')).toHaveCount(3);
    await expect(page.locator('.bar')).toHaveCount(1);
  });

  test('a perfect run is celebrated without a review list', async ({ page }) => {
    await openQuiz(page);
    await page.locator('.start-btn').click();
    await playRun(page, 15);

    await expect(page.locator('.score-value')).toHaveText('100%');
    await expect(page.locator('.score-verdict')).toHaveText('ТЫ В 90 ПЕРЦЕНТИЛЕ');
    await expect(page.locator('.clean-sheet')).toBeVisible();
    await expect(page.locator('.miss')).toHaveCount(0);
  });

  test('the result feeds the statistics on the topic screen', async ({ page }) => {
    await openQuiz(page);
    await page.locator('.start-btn').click();
    await playRun(page, 9);
    await page.locator('.close-btn').click();

    await expect(stat(page, 0)).toHaveText('1');
    await expect(stat(page, 1)).toHaveText('60%');
    await expect(stat(page, 2)).toHaveText('60%');
    await expect(stat(page, 3)).toHaveText('60%');
    await expect(page.locator('.topic-best').first()).toHaveText('ЛУЧШИЙ 60%');
    await expect(page.locator('.on-target-line')).toContainText('0 ИЗ 1');
  });

  test('each topic keeps its own statistics', async ({ page }) => {
    await openQuiz(page);

    // Take a perfect run on the AI topic.
    await page.locator('.topic', { hasText: 'ИИ' }).click();
    await page.locator('.start-btn').click();
    await playRun(page, 15);
    await page.locator('.close-btn').click();
    await expect(stat(page, 0)).toHaveText('1');
    await expect(stat(page, 2)).toHaveText('100%');

    // Switching to another topic shows that topic's (empty) history.
    await page.locator('.topic', { hasText: 'ВЫШМАТ' }).click();
    await expect(stat(page, 0)).toHaveText('0');
    await expect(stat(page, 2)).toHaveText('—');
    await expect(page.locator('.chart-empty')).toBeVisible();

    // And switching back restores it.
    await page.locator('.topic', { hasText: 'ИИ' }).click();
    await expect(stat(page, 0)).toHaveText('1');
    await expect(page.locator('.bar')).toHaveCount(1);
  });

  test('the selected topic survives a reload', async ({ page }) => {
    await openQuiz(page);
    await page.locator('.topic', { hasText: 'ВЫШМАТ' }).click();
    // Let the selection settle before reloading — the write is an effect, so a
    // reload fired on the same tick can beat it to localStorage.
    await expect(page.locator('.topic.active .topic-title')).toHaveText('ВЫШМАТ');

    await page.reload();

    await expect(page.locator('.topic.active .topic-title')).toHaveText('ВЫШМАТ');
  });

  test('ЕЩЁ РАЗ draws a fresh run', async ({ page }) => {
    await openQuiz(page);
    await page.locator('.start-btn').click();
    await playRun(page, 15);
    await page.locator('.again-btn').click();

    await expect(page.locator('.runner-step')).toHaveText('ВОПРОС 1/15');
    await expect(page.locator('.runner-score')).toContainText('0');
  });

  test('leaving a run mid-way records nothing', async ({ page }) => {
    await openQuiz(page);
    await page.locator('.start-btn').click();
    await answer(page, true);

    await page.locator('.quit-btn').click();
    await expect(page.locator('.quit-btn')).toHaveText('ТОЧНО?');
    await page.locator('.quit-btn').click();

    await expect(page.locator('.topic-list')).toBeVisible();
    await expect(stat(page, 0)).toHaveText('0');
  });

  test('an interrupted run is resumed after a reload', async ({ page }) => {
    await openQuiz(page);
    await page.locator('.start-btn').click();
    await answer(page, true);
    await answer(page, false);
    await expect(page.locator('.runner-step')).toHaveText('ВОПРОС 3/15');
    const prompt = await page.locator('.prompt').textContent();

    await page.reload();

    await expect(page.locator('.runner-step')).toHaveText('ВОПРОС 3/15');
    await expect(page.locator('.prompt')).toHaveText(prompt!);
    await expect(page.locator('.runner-score')).toContainText('1');
    await expect(page.locator('.segment.correct')).toHaveCount(1);
    await expect(page.locator('.segment.wrong')).toHaveCount(1);
  });

  test('the history survives a reload', async ({ page }) => {
    await openQuiz(page);
    await page.locator('.start-btn').click();
    await playRun(page, 6);
    await page.locator('.close-btn').click();

    await page.reload();

    await expect(stat(page, 0)).toHaveText('1');
    await expect(stat(page, 1)).toHaveText('40%');
    await expect(page.locator('.bar')).toHaveCount(1);
  });

  test('the chart draws only the last 90 of a longer history', async ({ page }) => {
    await seed(
      page,
      attempts(120, (i) => i % 16),
    );
    await page.goto('/');

    await expect(page.locator('.bar')).toHaveCount(90);
    await expect(stat(page, 0)).toHaveText('120');
    // Attempt #31 is the oldest one still in the window: 30 % 16 = 14 of 15.
    await expect(page.locator('.bar').first()).toHaveAttribute('title', '#1: 93% (14/15)');
    await expect(page.locator('.bar').last()).toHaveAttribute('title', '#90: 47% (7/15)');
  });

  test('the chart colours runs by how good they were', async ({ page }) => {
    await seed(page, [
      ...attempts(1, () => 15),
      ...attempts(1, () => 12).map((a) => ({ ...a, id: 'b', at: '2026-02-01T10:00:00.000Z' })),
      ...attempts(1, () => 2).map((a) => ({ ...a, id: 'c', at: '2026-03-01T10:00:00.000Z' })),
    ]);
    await page.goto('/');

    await expect(page.locator('.bar.high')).toHaveCount(1);
    await expect(page.locator('.bar.mid')).toHaveCount(1);
    await expect(page.locator('.bar.bad')).toHaveCount(1);
  });

  test('the statistics can be reset with a confirmation', async ({ page }) => {
    await seed(
      page,
      attempts(5, () => 12),
    );
    await page.goto('/');
    await expect(stat(page, 0)).toHaveText('5');

    await page.locator('.reset-btn').click();
    await expect(page.locator('.reset-btn')).toHaveText('ТОЧНО СБРОСИТЬ?');
    await page.locator('.reset-btn').click();

    await expect(page.locator('.chart-empty')).toBeVisible();
    await expect(stat(page, 0)).toHaveText('0');
    await expect(page.locator('.reset-btn')).toHaveCount(0);
  });

  test('the app reopens on the quiz section', async ({ page }) => {
    await openQuiz(page);

    await page.reload();

    await expect(page.locator('.topic-list')).toBeVisible();
    await expect(page.locator('.card')).toHaveCount(0);
  });

  test('the other sections keep working alongside the quiz', async ({ page }) => {
    await page.goto('/');
    await page.locator('.card').first().locator('.toggle-area').click();
    await expect(page.locator('.progress-label')).toContainText('1/25');

    await page.locator('.nav-btn', { hasText: 'ККАЛ' }).click();
    await page.locator('.entry-input').fill('1200');
    await page.locator('.entry-submit').click();
    await expect(page.locator('.average-value')).toHaveText('1200');

    await page.locator('.nav-btn', { hasText: 'ТЕСТ' }).click();
    await page.locator('.start-btn').click();
    await playRun(page, 15);
    await expect(page.locator('.score-value')).toHaveText('100%');

    await page.locator('.nav-btn', { hasText: 'ККАЛ' }).click();
    await expect(page.locator('.average-value')).toHaveText('1200');

    await page.locator('.nav-btn', { hasText: 'ЧЕЛЛЕНДЖИ' }).click();
    await expect(page.locator('.progress-label')).toContainText('1/25');
  });

  test('a run keeps its place when the user visits another section', async ({ page }) => {
    await openQuiz(page);
    await page.locator('.start-btn').click();
    await answer(page, true);
    // Settle on question 2 before capturing it, or the read races the render.
    await expect(page.locator('.runner-step')).toHaveText('ВОПРОС 2/15');
    const prompt = await page.locator('.prompt').textContent();

    await page.locator('.nav-btn', { hasText: 'ЧЕЛЛЕНДЖИ' }).click();
    await page.locator('.nav-btn', { hasText: 'ТЕСТ' }).click();

    await expect(page.locator('.runner-step')).toHaveText('ВОПРОС 2/15');
    await expect(page.locator('.prompt')).toHaveText(prompt!);
  });

  test('works on a phone-sized screen without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await openQuiz(page);

    await expect(page.locator('.nav-btn')).toHaveCount(5);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.locator('.start-btn').click();
    await expect(page.locator('.option').first()).toBeVisible();
  });
});
