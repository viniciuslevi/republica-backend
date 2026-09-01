import { describe, expect, it } from "vitest";
import { calculateNextDueDate, getUpcomingOccurrences, shouldResetTask } from "./recurrence.js";

describe("calculateNextDueDate", () => {
  it("retorna null para tarefas únicas", () => {
    expect(calculateNextDueDate("Única", new Date("2026-01-10T12:00:00Z"))).toBeNull();
  });

  it("avança um dia à meia-noite para tarefas diárias", () => {
    const next = calculateNextDueDate("Diária", new Date("2026-01-10T18:30:00"));
    expect(next?.getDate()).toBe(11);
    expect(next?.getHours()).toBe(0);
  });

  it("avança sete dias para tarefas semanais", () => {
    const from = new Date("2026-01-10T00:00:00");
    const next = calculateNextDueDate("Semanal", from);
    const diffDays = (next!.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 0);
  });

  it("avança um mês para tarefas mensais", () => {
    const next = calculateNextDueDate("Mensal", new Date("2026-01-31T00:00:00"));
    expect(next?.getMonth()).toBe(2); // JS rola 31/jan + 1 mês para março (fev não tem 31 dias)
  });
});

describe("shouldResetTask", () => {
  it("nunca reseta tarefas não concluídas", () => {
    expect(
      shouldResetTask({
        id: "t1",
        title: "x",
        assigneeId: null,
        recurrence: "Diária",
        done: false,
        lastCompletedAt: null,
        nextDueDate: new Date("2020-01-01"),
      })
    ).toBe(false);
  });

  it("nunca reseta tarefas únicas mesmo concluídas", () => {
    expect(
      shouldResetTask({
        id: "t1",
        title: "x",
        assigneeId: null,
        recurrence: "Única",
        done: true,
        lastCompletedAt: new Date("2020-01-01"),
        nextDueDate: null,
      })
    ).toBe(false);
  });

  it("reseta quando nextDueDate já passou", () => {
    expect(
      shouldResetTask(
        {
          id: "t1",
          title: "x",
          assigneeId: null,
          recurrence: "Diária",
          done: true,
          lastCompletedAt: new Date("2026-01-09"),
          nextDueDate: new Date("2026-01-10T00:00:00"),
        },
        new Date("2026-01-10T00:00:01")
      )
    ).toBe(true);
  });

  it("não reseta antes do nextDueDate chegar", () => {
    expect(
      shouldResetTask(
        {
          id: "t1",
          title: "x",
          assigneeId: null,
          recurrence: "Diária",
          done: true,
          lastCompletedAt: new Date("2026-01-09T00:00:00"),
          nextDueDate: new Date("2026-01-10T00:00:00"),
        },
        new Date("2026-01-09T12:00:00")
      )
    ).toBe(false);
  });
});

describe("getUpcomingOccurrences", () => {
  it("ignora tarefas únicas e projeta ocorrências futuras de tarefas recorrentes", () => {
    const now = new Date("2026-01-01T00:00:00");
    const occurrences = getUpcomingOccurrences(
      [
        {
          id: "t-unica",
          title: "Tarefa única",
          assigneeId: null,
          recurrence: "Única",
          done: false,
          lastCompletedAt: null,
          nextDueDate: null,
        },
        {
          id: "t-diaria",
          title: "Tarefa diária",
          assigneeId: "u1",
          recurrence: "Diária",
          done: false,
          lastCompletedAt: null,
          nextDueDate: null,
        },
      ],
      { horizonDays: 3, occurrencesPerTask: 10, now }
    );

    expect(occurrences.every((o) => o.taskId === "t-diaria")).toBe(true);
    expect(occurrences.length).toBeGreaterThan(0);
    expect(occurrences).toEqual([...occurrences].sort((a, b) => a.date.getTime() - b.date.getTime()));
  });
});
