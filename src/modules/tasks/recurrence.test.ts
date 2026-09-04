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

  it("calcula data limite para tarefa única com dia e horário opcionais", () => {
    const next = calculateNextDueDate("Única", new Date("2026-01-01T00:00:00Z"), {
      dueDate: "2026-01-15",
      dueTime: "14:30",
    });
    expect(next).not.toBeNull();
    expect(next?.getDate()).toBe(15);
    expect(next?.getHours()).toBe(14);
    expect(next?.getMinutes()).toBe(30);
  });

  it("calcula horário específico para tarefas diárias", () => {
    // Se o horário ainda não passou hoje, retorna hoje no horário
    const now = new Date("2026-01-10T10:00:00");
    const next = calculateNextDueDate("Diária", now, { dueTime: "18:00" });
    expect(next?.getDate()).toBe(10);
    expect(next?.getHours()).toBe(18);
    expect(next?.getMinutes()).toBe(0);

    // Se o horário já passou hoje, retorna amanhã no horário
    const past = new Date("2026-01-10T19:00:00");
    const nextDay = calculateNextDueDate("Diária", past, { dueTime: "18:00" });
    expect(nextDay?.getDate()).toBe(11);
    expect(nextDay?.getHours()).toBe(18);
  });

  it("calcula dia da semana específico para tarefas semanais", () => {
    // 2026-01-10 é sábado (getDay() === 6). Próxima segunda (1):
    const saturday = new Date("2026-01-10T12:00:00");
    const nextMonday = calculateNextDueDate("Semanal", saturday, { weekDay: 1, dueTime: "09:00" });
    expect(nextMonday?.getDay()).toBe(1); // Segunda
    expect(nextMonday?.getDate()).toBe(12); // 12 de janeiro
    expect(nextMonday?.getHours()).toBe(9);
    expect(nextMonday?.getMinutes()).toBe(0);
  });

  it("calcula dia do mês específico para tarefas mensais", () => {
    // Se for dia 10 e a tarefa é no dia 20:
    const from = new Date("2026-01-10T12:00:00");
    const next = calculateNextDueDate("Mensal", from, { monthDay: 20, dueTime: "10:00" });
    expect(next?.getMonth()).toBe(0); // Janeiro
    expect(next?.getDate()).toBe(20);
    expect(next?.getHours()).toBe(10);

    // Se já passou do dia 20 em janeiro:
    const past = new Date("2026-01-25T12:00:00");
    const nextMonth = calculateNextDueDate("Mensal", past, { monthDay: 20, dueTime: "10:00" });
    expect(nextMonth?.getMonth()).toBe(1); // Fevereiro
    expect(nextMonth?.getDate()).toBe(20);
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
