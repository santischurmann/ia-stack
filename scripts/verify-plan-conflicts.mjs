import { readFileSync } from 'node:fs';

const USAGE = 'usage: node scripts/verify-plan-conflicts.mjs check <tasks.json>';
const WRITE_FIELDS = ['files_to_create', 'files_to_modify', 'test_files'];

function reject(message) {
  console.error(`REJECTED: ${message}`);
  process.exitCode = 1;
}

function normalizePath(value, taskId, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${taskId}.${field} contains an empty or non-string path`);
  }

  const normalized = value.trim().replaceAll('\\', '/').replace(/^(\.\/)+/, '').replace(/\/{2,}/g, '/');
  if (normalized === '' || normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized) || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`${taskId}.${field} contains a non-project path: ${value}`);
  }
  return normalized;
}

function validatePlan(plan) {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.tasks)) {
    throw new Error('tasks.json must contain a tasks array');
  }

  const tasksById = new Map();
  const writersByPath = new Map();

  for (const task of plan.tasks) {
    if (!task || typeof task !== 'object' || typeof task.id !== 'string' || task.id.trim() === '') {
      throw new Error('every task requires a non-empty string id');
    }
    const id = task.id.trim();
    if (tasksById.has(id)) {
      throw new Error(`duplicate task id: ${id}`);
    }

    const taskPaths = new Set();
    for (const field of WRITE_FIELDS) {
      if (!Array.isArray(task[field])) {
        throw new Error(`${id}.${field} must be an array`);
      }
      for (const value of task[field]) {
        taskPaths.add(normalizePath(value, id, field));
      }
    }
    if (!Array.isArray(task.depends_on)) {
      throw new Error(`${id}.depends_on must be an array`);
    }

    tasksById.set(id, { id, dependsOn: task.depends_on, paths: taskPaths });
    for (const path of taskPaths) {
      if (!writersByPath.has(path)) writersByPath.set(path, new Set());
      writersByPath.get(path).add(id);
    }
  }

  for (const task of tasksById.values()) {
    const seen = new Set();
    for (const dependency of task.dependsOn) {
      if (typeof dependency !== 'string' || dependency.trim() === '') {
        throw new Error(`${task.id}.depends_on contains an empty or non-string task id`);
      }
      const dependencyId = dependency.trim();
      if (!tasksById.has(dependencyId)) {
        throw new Error(`${task.id}.depends_on references unknown task ${dependencyId}`);
      }
      if (dependencyId === task.id) {
        throw new Error(`${task.id}.depends_on cannot reference itself`);
      }
      if (seen.has(dependencyId)) {
        throw new Error(`${task.id}.depends_on repeats ${dependencyId}`);
      }
      seen.add(dependencyId);
    }
  }

  return { tasksById, writersByPath };
}

function hasDependency(tasksById, taskId, prerequisiteId, visiting = new Set()) {
  if (visiting.has(taskId)) {
    throw new Error(`dependency cycle reaches ${taskId}`);
  }

  visiting.add(taskId);
  for (const dependency of tasksById.get(taskId).dependsOn) {
    if (dependency === prerequisiteId || hasDependency(tasksById, dependency, prerequisiteId, visiting)) {
      visiting.delete(taskId);
      return true;
    }
  }
  visiting.delete(taskId);
  return false;
}

function assertAcyclic(tasksById) {
  for (const id of tasksById.keys()) {
    hasDependency(tasksById, id, '__vcp_nonexistent_dependency_probe__');
  }
}

function check(planPath) {
  let plan;
  try {
    plan = JSON.parse(readFileSync(planPath, 'utf8'));
  } catch (error) {
    console.error(`${USAGE}\nUnable to read valid JSON from ${planPath}: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  let tasksById;
  let writersByPath;
  try {
    ({ tasksById, writersByPath } = validatePlan(plan));
    assertAcyclic(tasksById);
  } catch (error) {
    reject(error.message);
    return;
  }

  const conflicts = [];
  const serialized = [];
  for (const [path, writerIds] of [...writersByPath.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const ids = [...writerIds].sort();
    for (let left = 0; left < ids.length; left += 1) {
      for (let right = left + 1; right < ids.length; right += 1) {
        const first = ids[left];
        const second = ids[right];
        const ordered = hasDependency(tasksById, first, second) || hasDependency(tasksById, second, first);
        if (ordered) {
          serialized.push({ first, second, path });
        } else {
          conflicts.push({ first, second, path });
        }
      }
    }
  }

  for (const { first, second, path } of serialized) {
    console.log(`SERIALIZED: ${first} and ${second} both declare write access to ${path}; dependency order exists.`);
  }
  for (const { first, second, path } of conflicts) {
    console.error(`CONFLICT: ${first} and ${second} both declare write access to ${path} without dependency ordering. Serialize or split the tasks.`);
  }

  if (conflicts.length > 0) {
    process.exitCode = 1;
    return;
  }

  console.log(`OK: plan conflict scan passed — ${tasksById.size} task(s), ${writersByPath.size} declared writer path(s), ${serialized.length} serialized overlap(s); no unsequenced write conflicts.`);
}

const [command, planPath] = process.argv.slice(2);
if (command !== 'check' || !planPath || process.argv.length !== 4) {
  console.error(USAGE);
  process.exitCode = 2;
} else {
  check(planPath);
}
