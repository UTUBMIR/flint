export type RuntimeProblem = {
    id: number;
    message: string;
    stack?: string;
    when: number;
};

export class ProblemsStore {
    private static readonly maxProblems = 100;

    private static runtimeProblems: RuntimeProblem[] = [];
    private static nextId = 1;

    public static addRuntimeError(message: string, stack?: string): boolean {
        const last = ProblemsStore.runtimeProblems[ProblemsStore.runtimeProblems.length - 1];
        if (last && last.message === message) {
            return false;
        }

        const problem: RuntimeProblem = {
            id: ProblemsStore.nextId++,
            message,
            when: Date.now()
        };
        if (stack !== undefined) {
            problem.stack = stack;
        }

        ProblemsStore.runtimeProblems.push(problem);

        if (ProblemsStore.runtimeProblems.length > ProblemsStore.maxProblems) {
            ProblemsStore.runtimeProblems.shift();
        }
        return true;
    }

    public static getRuntimeErrors(): RuntimeProblem[] {
        return [...ProblemsStore.runtimeProblems].reverse();
    }

    public static get runtimeErrorCount(): number {
        return ProblemsStore.runtimeProblems.length;
    }

    public static clearRuntimeErrors(): void {
        ProblemsStore.runtimeProblems = [];
    }
}