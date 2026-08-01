import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { QUIZ_TOPICS, findTopic, questionsPerRun } from '../../data/quiz-topics.data';
import { CHART_ATTEMPTS, QuizService, TARGET_PERCENT } from '../../services/quiz.service';
import { QuizSessionService } from '../../services/quiz-session.service';
import { SoundService } from '../../services/sound.service';
import { QuizChartComponent } from '../quiz-chart/quiz-chart.component';
import { QuizResultComponent } from '../quiz-result/quiz-result.component';
import { QuizRunnerComponent } from '../quiz-runner/quiz-runner.component';

/** The quiz section: pick a topic, take a run, look at the statistics. */
@Component({
  selector: 'app-quiz-page',
  standalone: true,
  imports: [QuizChartComponent, QuizResultComponent, QuizRunnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz-page.component.html',
  styleUrl: './quiz-page.component.scss',
})
export class QuizPageComponent {
  protected readonly quiz = inject(QuizService);
  protected readonly session = inject(QuizSessionService);
  private readonly sound = inject(SoundService);

  protected readonly topics = QUIZ_TOPICS;
  protected readonly target = TARGET_PERCENT;
  protected readonly chartCapacity = CHART_ATTEMPTS;

  /** While a run is on screen the stats follow that run's topic, not the picker. */
  protected readonly activeTopicId = computed(() =>
    this.session.status() === 'idle' ? this.quiz.topicId() : this.session.topicId(),
  );

  protected readonly topic = computed(() => findTopic(this.activeTopicId()) ?? this.topics[0]);
  protected readonly runLength = computed(() => questionsPerRun(this.topic()));
  protected readonly stats = computed(() => this.quiz.statsFor(this.activeTopicId()));
  protected readonly chartAttempts = computed(() =>
    this.quiz.recentFor(this.activeTopicId(), CHART_ATTEMPTS),
  );

  protected readonly topicCards = computed(() =>
    this.topics.map((topic) => ({
      topic,
      stats: this.quiz.statsFor(topic.id),
      length: questionsPerRun(topic),
    })),
  );

  /** Wiping the history takes a second tap. */
  protected readonly confirmReset = signal(false);

  protected onSelectTopic(topicId: string): void {
    if (topicId === this.quiz.topicId()) return;
    this.quiz.selectTopic(topicId);
    this.confirmReset.set(false);
    this.sound.playClick();
  }

  protected onStart(): void {
    if (this.session.start(this.quiz.topicId())) {
      this.confirmReset.set(false);
      this.sound.playClick();
    }
  }

  protected onAnswer(optionIndex: number): void {
    const correct = this.session.answer(optionIndex);
    if (correct === null) return;
    if (correct) {
      this.sound.playCorrect();
    } else {
      this.sound.playWrong();
    }
  }

  protected onNext(): void {
    const wasLast = this.session.isLast();
    this.session.next();
    if (!wasLast) {
      this.sound.playClick();
      return;
    }
    if (this.session.percent() >= TARGET_PERCENT) {
      this.sound.playFanfare();
    } else {
      this.sound.playFail();
    }
  }

  protected onQuit(): void {
    this.session.abandon();
    this.sound.playUndo();
  }

  protected onAgain(): void {
    if (this.session.restart()) this.sound.playClick();
  }

  protected onClose(): void {
    this.session.reset();
    this.sound.playClick();
  }

  protected onResetStats(): void {
    if (!this.confirmReset()) {
      this.confirmReset.set(true);
      this.sound.playClick();
      return;
    }
    this.quiz.clearTopic(this.activeTopicId());
    this.confirmReset.set(false);
    this.sound.playUndo();
  }

  protected percentLabel(value: number | null): string {
    return value === null ? '—' : `${value}%`;
  }
}
