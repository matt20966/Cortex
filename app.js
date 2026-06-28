// LOCAL STORAGE KEY
const STORAGE_KEY = 'codespace_planner_data';

// DEFAULT / INITIAL DATA
const DEFAULT_DATA = {
    theme: 'light-theme',
    dailyNotes: {},
    projects: [],
    skills: [],
    tasks: []
};

// STATE MANAGEMENT
class AppState {
    constructor() {
        this.data = this.loadData();
        this.currentView = 'tasks'; // 'tasks', 'projects', 'calendar', 'skills', 'daily_report', 'agent_runner'
        this.taskViewMode = 'list'; // 'list', 'kanban'
        this.filters = {
            status: 'all',
            priority: 'all',
            project: 'all',
            search: ''
        };
        this.calendarDate = new Date(); // defaults to current month/year
        this.draggedTaskId = null;

        this.init();
    }

    createDefaultData() {
        return {
            theme: 'light-theme',
            dailyNotes: {},
            projects: [],
            skills: [],
            tasks: []
        };
    }

    normalizeData(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return this.createDefaultData();
        }

        return {
            theme: data.theme || 'light-theme',
            dailyNotes: data.dailyNotes && typeof data.dailyNotes === 'object' && !Array.isArray(data.dailyNotes) ? data.dailyNotes : {},
            projects: Array.isArray(data.projects) ? data.projects : [],
            skills: Array.isArray(data.skills) ? data.skills : [],
            tasks: Array.isArray(data.tasks) ? data.tasks : []
        };
    }

    isLegacySampleData(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return false;
        }

        const sampleProjectIds = ['proj-1', 'proj-2', 'proj-3'];
        const sampleTaskIds = ['task-1', 'task-2', 'task-3', 'task-4', 'task-5', 'task-6'];
        const sampleSkillIds = ['skill-1', 'skill-2', 'skill-3'];

        const hasSampleProject = Array.isArray(data.projects) && data.projects.some(project => sampleProjectIds.includes(project.id));
        const hasSampleTask = Array.isArray(data.tasks) && data.tasks.some(task => sampleTaskIds.includes(task.id));
        const hasSampleSkill = Array.isArray(data.skills) && data.skills.some(skill => sampleSkillIds.includes(skill.id));

        return hasSampleProject || hasSampleTask || hasSampleSkill;
    }

    loadData() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (this.isLegacySampleData(parsed)) {
                    console.info('Legacy sample data detected. Resetting workspace to an empty state.');
                    return this.createDefaultData();
                }
                return this.normalizeData(parsed);
            } catch (e) {
                console.error('Error parsing localStorage data, using defaults:', e);
            }
        }
        return this.createDefaultData();
    }

    saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        this.render();
    }

    // Initialize event listeners and first render
    init() {
        document.body.className = 'light-theme';
        
        // Set Topbar Date Display
        const topbarDateEl = document.querySelector('#topbar-date-display span');
        if (topbarDateEl) {
            const today = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            topbarDateEl.textContent = today.toLocaleDateString('en-US', options);
        }

        this.setupEventListeners();
        this.render();
    }

    setupEventListeners() {
        // Sidebar Navigation
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.getAttribute('data-view');
                this.switchView(view);
            });
        });

        // Tasks View Mode Toggle (List vs Kanban)
        document.querySelectorAll('.btn-view-mode').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-view-mode').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.taskViewMode = btn.getAttribute('data-mode');
                this.renderTasks();
            });
        });

        // Search Input
        const searchInput = document.getElementById('search-input');
        const clearBtn = document.getElementById('btn-clear-search');
        searchInput.addEventListener('input', (e) => {
            this.filters.search = e.target.value.toLowerCase();
            if (this.filters.search) {
                clearBtn.classList.remove('hidden');
            } else {
                clearBtn.classList.add('hidden');
            }
            this.renderTasks();
        });
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            this.filters.search = '';
            clearBtn.classList.add('hidden');
            this.renderTasks();
        });

        // Task Filters
        document.getElementById('filter-status').addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.renderTasks();
        });
        document.getElementById('filter-priority').addEventListener('change', (e) => {
            this.filters.priority = e.target.value;
            this.renderTasks();
        });
        document.getElementById('filter-project').addEventListener('change', (e) => {
            this.filters.project = e.target.value;
            this.renderTasks();
        });

        // Add Project Buttons
        document.getElementById('btn-sidebar-add-project').addEventListener('click', () => {
            this.openProjectModal();
        });
        document.getElementById('btn-header-add-project').addEventListener('click', () => {
            this.openProjectModal();
        });

        // Add Skill Button
        document.getElementById('btn-header-add-skill').addEventListener('click', () => {
            this.openSkillModal();
        });

        // Modal Close Buttons
        document.querySelectorAll('.btn-close-modal, .btn-cancel-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
            });
        });

        // Form Submit: Task
        document.getElementById('form-task').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTaskForm();
        });
        // Delete Task Button
        document.getElementById('btn-delete-task').addEventListener('click', () => {
            const id = document.getElementById('task-id').value;
            if (id && confirm('Are you sure you want to delete this task?')) {
                this.data.tasks = this.data.tasks.filter(t => t.id !== id);
                document.getElementById('modal-task').classList.add('hidden');
                this.saveData();
            }
        });

        // Form Submit: Project
        document.getElementById('form-project').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProjectForm();
        });
        // Delete Project Button
        document.getElementById('btn-delete-project').addEventListener('click', () => {
            const id = document.getElementById('project-id').value;
            if (id && confirm('Are you sure you want to delete this project? All associated tasks will lose their project association.')) {
                this.data.projects = this.data.projects.filter(p => p.id !== id);
                this.data.tasks.forEach(t => {
                    if (t.projectId === id) t.projectId = '';
                });
                document.getElementById('modal-project').classList.add('hidden');
                this.saveData();
            }
        });

        // Form Submit: Skill
        document.getElementById('form-skill').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSkillForm();
        });
        // Delete Skill Button
        document.getElementById('btn-delete-skill').addEventListener('click', () => {
            const id = document.getElementById('skill-id').value;
            if (id && confirm('Are you sure you want to delete this skill folder?')) {
                this.data.skills = this.data.skills.filter(s => s.id !== id);
                document.getElementById('modal-skill').classList.add('hidden');
                this.saveData();
            }
        });

        // Daily Notes Input Save
        const notesInput = document.getElementById('daily-notes-input');
        notesInput.addEventListener('input', (e) => {
            const todayStr = new Date().toISOString().split('T')[0];
            if (!this.data.dailyNotes) this.data.dailyNotes = {};
            this.data.dailyNotes[todayStr] = e.target.value;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        });

        // Copy Daily Summary Button
        const copyBtn = document.getElementById('btn-copy-daily-summary');
        copyBtn.addEventListener('click', () => {
            const todayStr = new Date().toISOString().split('T')[0];
            const completedTasks = this.data.tasks.filter(t => t.status === 'completed');
            const activeProjects = this.data.projects.filter(p => p.status === 'active');
            const notes = (this.data.dailyNotes && this.data.dailyNotes[todayStr]) || "No notes logged for today.";

            let summaryText = `📊 DAILY STANDUP REPORT — ${todayStr}\n\n`;
            summaryText += `✅ TASKS COMPLETED (${completedTasks.length}):\n`;
            completedTasks.forEach(t => { summaryText += ` - ${t.title}\n`; });
            
            summaryText += `\n🚀 ACTIVE PROJECTS (${activeProjects.length}):\n`;
            activeProjects.forEach(p => { summaryText += ` - ${p.name}\n`; });

            summaryText += `\n📝 DAILY REFLECTION & NOTES:\n${notes}\n`;

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(summaryText).then(() => {
                    const originalText = copyBtn.querySelector('span').textContent;
                    copyBtn.querySelector('span').textContent = "Copied to Clipboard!";
                    setTimeout(() => { copyBtn.querySelector('span').textContent = originalText; }, 2000);
                }).catch(() => {
                    alert("Summary text:\n\n" + summaryText);
                });
            } else {
                alert("Summary text:\n\n" + summaryText);
            }
        });

        // Color picker display update
        const colorInput = document.getElementById('project-color');
        const colorDisplay = document.getElementById('color-hex-display');
        colorInput.addEventListener('input', (e) => {
            colorDisplay.textContent = e.target.value;
        });

        // Calendar Navigation Buttons
        document.getElementById('btn-calendar-prev').addEventListener('click', () => {
            this.calendarDate.setMonth(this.calendarDate.getMonth() - 1);
            this.renderCalendar();
        });
        document.getElementById('btn-calendar-next').addEventListener('click', () => {
            this.calendarDate.setMonth(this.calendarDate.getMonth() + 1);
            this.renderCalendar();
        });
        document.getElementById('btn-calendar-today').addEventListener('click', () => {
            this.calendarDate = new Date();
            this.renderCalendar();
        });

        // Setup Drag and Drop for Kanban Columns
        document.querySelectorAll('.kanban-column').forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                column.classList.add('drag-over');
            });
            column.addEventListener('dragleave', () => {
                column.classList.remove('drag-over');
            });
            column.addEventListener('drop', (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');
                const newStatus = column.getAttribute('data-status');
                if (this.draggedTaskId && newStatus) {
                    const task = this.data.tasks.find(t => t.id === this.draggedTaskId);
                    if (task && task.status !== newStatus) {
                        task.status = newStatus;
                        this.saveData();
                    }
                }
            });
        });

        // AGENT RUNNER BUTTON LISTENERS
        document.querySelectorAll('.btn-run-agent-instance').forEach(btn => {
            btn.addEventListener('click', () => {
                const agentId = btn.getAttribute('data-agent');
                this.runAgentSimulation(agentId, btn);
            });
        });

        document.getElementById('btn-run-custom-agent').addEventListener('click', () => {
            this.triggerGlobalWorkspaceSynthesis();
        });

        document.getElementById('btn-submit-agent-prompt').addEventListener('click', () => {
            const inputEl = document.getElementById('agent-prompt-input');
            const prompt = inputEl.value.trim();
            if (!prompt) return;
            this.appendConsoleLog(`User Prompt: "${prompt}"`, 'system');
            inputEl.value = '';
            this.runCustomPromptSimulation(prompt);
        });
    }

    switchView(viewName) {
        this.currentView = viewName;
        
        // Update navigation active states
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            if (item.getAttribute('data-view') === viewName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update topbar title and view controls
        const titleEl = document.getElementById('view-title');
        const searchBox = document.getElementById('global-search-container');
        const tasksControls = document.getElementById('tasks-view-controls');
        const projectsControls = document.getElementById('projects-view-controls');
        const skillsControls = document.getElementById('skills-view-controls');

        document.querySelectorAll('.view-section').forEach(sec => {
            sec.classList.remove('active');
            sec.classList.add('hidden');
        });

        if (viewName === 'tasks') {
            titleEl.textContent = 'Tasks';
            searchBox.classList.remove('hidden');
            tasksControls.classList.remove('hidden');
            projectsControls.classList.add('hidden');
            skillsControls.classList.add('hidden');
            document.getElementById('view-tasks').classList.remove('hidden');
            document.getElementById('view-tasks').classList.add('active');
            this.renderTasks();
        } else if (viewName === 'projects') {
            titleEl.textContent = 'Projects';
            searchBox.classList.add('hidden');
            tasksControls.classList.add('hidden');
            projectsControls.classList.remove('hidden');
            skillsControls.classList.add('hidden');
            document.getElementById('view-projects').classList.remove('hidden');
            document.getElementById('view-projects').classList.add('active');
            this.renderProjects();
        } else if (viewName === 'calendar') {
            titleEl.textContent = 'Calendar';
            searchBox.classList.add('hidden');
            tasksControls.classList.add('hidden');
            projectsControls.classList.add('hidden');
            skillsControls.classList.add('hidden');
            document.getElementById('view-calendar').classList.remove('hidden');
            document.getElementById('view-calendar').classList.add('active');
            this.renderCalendar();
        } else if (viewName === 'skills') {
            titleEl.textContent = 'Skills Folder';
            searchBox.classList.add('hidden');
            tasksControls.classList.add('hidden');
            projectsControls.classList.add('hidden');
            skillsControls.classList.remove('hidden');
            document.getElementById('view-skills').classList.remove('hidden');
            document.getElementById('view-skills').classList.add('active');
            this.renderSkills();
        } else if (viewName === 'daily_report') {
            titleEl.textContent = 'Daily Report';
            searchBox.classList.add('hidden');
            tasksControls.classList.add('hidden');
            projectsControls.classList.add('hidden');
            skillsControls.classList.add('hidden');
            document.getElementById('view-daily-report').classList.remove('hidden');
            document.getElementById('view-daily-report').classList.add('active');
            this.renderDailyReport();
        } else if (viewName === 'agent_runner') {
            titleEl.textContent = 'Agent Runner';
            searchBox.classList.add('hidden');
            tasksControls.classList.add('hidden');
            projectsControls.classList.add('hidden');
            skillsControls.classList.add('hidden');
            document.getElementById('view-agent-runner').classList.remove('hidden');
            document.getElementById('view-agent-runner').classList.add('active');
        }
    }

    // MAIN RENDER FUNCTION
    render() {
        this.renderSidebar();
        this.renderProjectFiltersAndSelects();

        if (this.currentView === 'tasks') {
            this.renderTasks();
        } else if (this.currentView === 'projects') {
            this.renderProjects();
        } else if (this.currentView === 'calendar') {
            this.renderCalendar();
        } else if (this.currentView === 'skills') {
            this.renderSkills();
        } else if (this.currentView === 'daily_report') {
            this.renderDailyReport();
        }
    }

    renderSidebar() {
        // Badges count
        const activeTasks = this.data.tasks.filter(t => t.status !== 'completed').length;
        const activeProjects = this.data.projects.filter(p => p.status === 'active').length;
        const totalSkills = (this.data.skills || []).length;

        document.getElementById('badge-tasks').textContent = activeTasks;
        document.getElementById('badge-projects').textContent = activeProjects;
        document.getElementById('badge-skills').textContent = totalSkills;

        // Render mini projects list in sidebar
        const sidebarProjContainer = document.getElementById('sidebar-projects-container');
        sidebarProjContainer.innerHTML = '';
        this.data.projects.forEach(p => {
            const item = document.createElement('a');
            item.className = 'project-mini-item';
            item.innerHTML = `
                <span class="project-dot" style="background-color: ${p.color}"></span>
                <span>${p.name}</span>
            `;
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchView('tasks');
                this.filters.project = p.id;
                document.getElementById('filter-project').value = p.id;
                this.renderTasks();
            });
            sidebarProjContainer.appendChild(item);
        });
    }

    renderProjectFiltersAndSelects() {
        // Filter Select in Tasks View
        const filterSelect = document.getElementById('filter-project');
        const currentFilterVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="all">All Projects</option>';
        this.data.projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            filterSelect.appendChild(opt);
        });
        filterSelect.value = currentFilterVal || 'all';

        // Modal Task Project Select
        const taskProjSelect = document.getElementById('task-project');
        const currentTaskProjVal = taskProjSelect.value;
        taskProjSelect.innerHTML = '<option value="">No Project</option>';
        this.data.projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            taskProjSelect.appendChild(opt);
        });
        taskProjSelect.value = currentTaskProjVal || '';
    }

    renderTasks() {
        const listContainer = document.getElementById('tasks-list-container');
        const kanbanContainer = document.getElementById('tasks-kanban-container');

        if (this.taskViewMode === 'list') {
            listContainer.classList.remove('hidden');
            kanbanContainer.classList.add('hidden');
            this.renderTasksList();
        } else {
            listContainer.classList.add('hidden');
            kanbanContainer.classList.remove('hidden');
            this.renderTasksKanban();
        }
    }

    filterTasks() {
        return this.data.tasks.filter(task => {
            if (this.filters.status !== 'all' && task.status !== this.filters.status) return false;
            if (this.filters.priority !== 'all' && task.priority !== this.filters.priority) return false;
            if (this.filters.project !== 'all' && task.projectId !== this.filters.project) return false;
            if (this.filters.search) {
                const query = this.filters.search;
                const matchTitle = task.title.toLowerCase().includes(query);
                const matchDesc = (task.description || '').toLowerCase().includes(query);
                if (!matchTitle && !matchDesc) return false;
            }
            return true;
        });
    }

    getProjectForTask(projectId) {
        return this.data.projects.find(p => p.id === projectId);
    }

    renderTasksList() {
        const filtered = this.filterTasks();
        const todoTasks = filtered.filter(t => t.status === 'todo');
        const inprogressTasks = filtered.filter(t => t.status === 'in_progress');
        const completedTasks = filtered.filter(t => t.status === 'completed');

        document.getElementById('count-todo').textContent = todoTasks.length;
        document.getElementById('count-inprogress').textContent = inprogressTasks.length;
        document.getElementById('count-completed').textContent = completedTasks.length;

        const renderSection = (tasks, containerId) => {
            const container = document.getElementById(containerId);
            container.innerHTML = '';
            if (tasks.length === 0) {
                container.innerHTML = `<p class="text-muted" style="padding: 0.5rem 0;">No tasks found in this section.</p>`;
                return;
            }

            tasks.forEach(task => {
                const project = this.getProjectForTask(task.projectId);
                const card = document.createElement('div');
                card.className = `task-card-list ${task.status === 'completed' ? 'completed' : ''}`;
                
                let checkIcon = task.status === 'completed' ? `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>` : '';

                card.innerHTML = `
                    <button class="task-checkbox" title="Toggle Status">${checkIcon}</button>
                    <div class="task-list-info">
                        <div class="task-title">${task.title}</div>
                        ${task.description ? `<div class="task-desc">${task.description}</div>` : ''}
                        <div class="task-tags-row">
                            <span class="badge-priority ${task.priority}">${task.priority}</span>
                            ${project ? `<span class="badge-tag" style="border-left: 3px solid ${project.color}">${project.name}</span>` : ''}
                            ${task.dueDate ? `<span class="task-due-date ${new Date(task.dueDate) < new Date() && task.status !== 'completed' ? 'overdue' : ''}">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                ${task.dueDate}
                            </span>` : ''}
                        </div>
                    </div>
                    <div class="task-actions">
                        <button class="btn-icon btn-edit-task" title="Edit Task">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                    </div>
                `;

                // Toggle Checkbox Click
                card.querySelector('.task-checkbox').addEventListener('click', () => {
                    task.status = task.status === 'completed' ? 'todo' : 'completed';
                    this.saveData();
                });

                // Edit Task Click
                card.querySelector('.btn-edit-task').addEventListener('click', () => {
                    this.openTaskModal(task);
                });
                card.querySelector('.task-title').addEventListener('click', () => {
                    this.openTaskModal(task);
                });

                container.appendChild(card);
            });
        };

        renderSection(todoTasks, 'list-todo');
        renderSection(inprogressTasks, 'list-inprogress');
        renderSection(completedTasks, 'list-completed');
    }

    renderTasksKanban() {
        const filtered = this.filterTasks();
        const todoTasks = filtered.filter(t => t.status === 'todo');
        const inprogressTasks = filtered.filter(t => t.status === 'in_progress');
        const completedTasks = filtered.filter(t => t.status === 'completed');

        document.getElementById('kanban-count-todo').textContent = todoTasks.length;
        document.getElementById('kanban-count-inprogress').textContent = inprogressTasks.length;
        document.getElementById('kanban-count-completed').textContent = completedTasks.length;

        const renderColumn = (tasks, containerId) => {
            const container = document.getElementById(containerId);
            container.innerHTML = '';

            tasks.forEach(task => {
                const project = this.getProjectForTask(task.projectId);
                const card = document.createElement('div');
                card.className = `kanban-card ${task.status === 'completed' ? 'completed' : ''}`;
                card.setAttribute('draggable', 'true');
                
                card.innerHTML = `
                    <div class="kanban-card-header">
                        <div class="kanban-card-title">${task.title}</div>
                        <button class="btn-icon-small btn-edit-kanban-task" title="Edit Task">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                    </div>
                    ${task.description ? `<div class="task-desc">${task.description}</div>` : ''}
                    <div class="task-tags-row" style="flex-wrap: wrap;">
                        <span class="badge-priority ${task.priority}">${task.priority}</span>
                        ${project ? `<span class="badge-tag" style="border-left: 3px solid ${project.color}">${project.name}</span>` : ''}
                    </div>
                    ${task.dueDate ? `
                    <div class="kanban-card-footer">
                        <span class="task-due-date ${new Date(task.dueDate) < new Date() && task.status !== 'completed' ? 'overdue' : ''}">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            ${task.dueDate}
                        </span>
                    </div>` : ''}
                `;

                // Drag Event Listeners
                card.addEventListener('dragstart', (e) => {
                    this.draggedTaskId = task.id;
                    card.style.opacity = '0.5';
                });
                card.addEventListener('dragend', () => {
                    this.draggedTaskId = null;
                    card.style.opacity = '1';
                });

                // Edit Click
                card.querySelector('.btn-edit-kanban-task').addEventListener('click', () => {
                    this.openTaskModal(task);
                });
                card.querySelector('.kanban-card-title').addEventListener('click', () => {
                    this.openTaskModal(task);
                });

                container.appendChild(card);
            });
        };

        renderColumn(todoTasks, 'kanban-todo');
        renderColumn(inprogressTasks, 'kanban-inprogress');
        renderColumn(completedTasks, 'kanban-completed');
    }

    renderProjects() {
        const container = document.getElementById('projects-grid-container');
        container.innerHTML = '';

        if (this.data.projects.length === 0) {
            container.innerHTML = `<p class="text-muted">No projects created yet. Click "New Project" to start organizing.</p>`;
            return;
        }

        this.data.projects.forEach(project => {
            const projectTasks = this.data.tasks.filter(t => t.projectId === project.id);
            const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
            const totalTasks = projectTasks.length;
            const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            const card = document.createElement('div');
            card.className = 'project-card';
            
            card.innerHTML = `
                <div class="project-card-header">
                    <div class="project-title-group">
                        <span class="project-dot" style="background-color: ${project.color}; width: 14px; height: 14px;"></span>
                        <h3 class="project-card-title">${project.name}</h3>
                    </div>
                    <span class="project-status-badge ${project.status}">${project.status.replace('_', ' ')}</span>
                </div>
                ${project.description ? `<div class="project-card-desc">${project.description}</div>` : ''}
                <div class="project-progress-section">
                    <div class="progress-header">
                        <span>Progress (${completedTasks}/${totalTasks} tasks)</span>
                        <span>${progressPercent}%</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${progressPercent}%; background-color: ${project.color};"></div>
                    </div>
                </div>
                <div class="project-card-footer">
                    <span>${project.deadline ? `Deadline: ${project.deadline}` : 'No deadline'}</span>
                    <div class="footer-actions">
                        <button class="btn-icon btn-filter-proj-tasks" title="View Project Tasks">
                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                        </button>
                        <button class="btn-icon btn-edit-proj" title="Edit Project">
                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                    </div>
                </div>
            `;

            // Filter Project Tasks Click
            card.querySelector('.btn-filter-proj-tasks').addEventListener('click', () => {
                this.switchView('tasks');
                this.filters.project = project.id;
                document.getElementById('filter-project').value = project.id;
                this.renderTasks();
            });

            // Edit Project Click
            card.querySelector('.btn-edit-proj').addEventListener('click', () => {
                this.openProjectModal(project);
            });
            card.querySelector('.project-card-title').addEventListener('click', () => {
                this.openProjectModal(project);
            });

            container.appendChild(card);
        });
    }

    renderSkills() {
        const container = document.getElementById('skills-grid-container');
        container.innerHTML = '';

        if (!this.data.skills || this.data.skills.length === 0) {
            container.innerHTML = `<p class="text-muted">No skills created yet. Click "New Skill" above to build your skills folder.</p>`;
            return;
        }

        this.data.skills.forEach(skill => {
            const card = document.createElement('div');
            card.className = 'skill-card';
            
            card.innerHTML = `
                <div class="skill-card-header">
                    <div class="skill-title-group">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" style="color: var(--primary);"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        <h3 class="skill-card-title">${skill.name}</h3>
                    </div>
                    <span class="skill-level-badge ${skill.level}">${skill.level}</span>
                </div>
                ${skill.description ? `<div class="skill-card-desc">${skill.description}</div>` : ''}
                ${skill.notes ? `
                <div class="skill-notes-box">
                    <strong>Notes & Resources:</strong><br>
                    ${skill.notes}
                </div>` : ''}
                <div class="skill-card-footer">
                    <span>Folder Category: Knowledge Base</span>
                    <div class="footer-actions">
                        <button class="btn-icon btn-edit-skill" title="Edit Skill Folder">
                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                    </div>
                </div>
            `;

            // Edit Skill Click
            card.querySelector('.btn-edit-skill').addEventListener('click', () => {
                this.openSkillModal(skill);
            });
            card.querySelector('.skill-card-title').addEventListener('click', () => {
                this.openSkillModal(skill);
            });

            container.appendChild(card);
        });
    }

    renderDailyReport() {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const dateTitleEl = document.getElementById('daily-report-date-title');
        
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateTitleEl.textContent = `Daily Summary — ${today.toLocaleDateString('en-US', options)}`;

        // Metrics Calculation
        const completedCount = this.data.tasks.filter(t => t.status === 'completed').length;
        const pendingCount = this.data.tasks.filter(t => t.status !== 'completed').length;
        const activeProjectsCount = this.data.projects.filter(p => p.status === 'active').length;
        const skillsCount = (this.data.skills || []).length;

        document.getElementById('metric-completed').textContent = completedCount;
        document.getElementById('metric-pending').textContent = pendingCount;
        document.getElementById('metric-projects').textContent = activeProjectsCount;
        document.getElementById('metric-skills').textContent = skillsCount;

        // Load Notes
        const notesInput = document.getElementById('daily-notes-input');
        if (this.data.dailyNotes && this.data.dailyNotes[todayStr]) {
            notesInput.value = this.data.dailyNotes[todayStr];
        } else {
            notesInput.value = '';
        }

        // Render Action Items Due Today or Overdue
        const tasksContainer = document.getElementById('daily-report-tasks-container');
        tasksContainer.innerHTML = '';

        const actionTasks = this.data.tasks.filter(t => {
            if (t.status === 'completed') return false;
            if (!t.dueDate) return false;
            const dueTime = new Date(t.dueDate).getTime();
            const todayTime = new Date(todayStr).getTime();
            return dueTime <= todayTime; // due today or overdue
        });

        if (actionTasks.length === 0) {
            tasksContainer.innerHTML = `<p class="text-muted" style="padding: 1rem 0;">🎉 No urgent or overdue tasks for today! You are all caught up.</p>`;
            return;
        }

        actionTasks.forEach(task => {
            const project = this.getProjectForTask(task.projectId);
            const card = document.createElement('div');
            card.className = `task-card-list`;

            card.innerHTML = `
                <button class="task-checkbox" title="Mark Completed"></button>
                <div class="task-list-info">
                    <div class="task-title">${task.title}</div>
                    ${task.description ? `<div class="task-desc">${task.description}</div>` : ''}
                    <div class="task-tags-row">
                        <span class="badge-priority ${task.priority}">${task.priority}</span>
                        ${project ? `<span class="badge-tag" style="border-left: 3px solid ${project.color}">${project.name}</span>` : ''}
                        <span class="task-due-date overdue">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            ${task.dueDate}
                        </span>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn-icon btn-edit-task" title="Edit Task">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                </div>
            `;

            // Checkbox Click
            card.querySelector('.task-checkbox').addEventListener('click', () => {
                task.status = 'completed';
                this.saveData();
                this.renderDailyReport();
            });

            // Edit Click
            card.querySelector('.btn-edit-task').addEventListener('click', () => {
                this.openTaskModal(task);
            });
            card.querySelector('.task-title').addEventListener('click', () => {
                this.openTaskModal(task);
            });

            tasksContainer.appendChild(card);
        });
    }

    renderCalendar() {
        const titleEl = document.getElementById('calendar-month-title');
        const daysContainer = document.getElementById('calendar-days-container');
        daysContainer.innerHTML = '';

        const year = this.calendarDate.getFullYear();
        const month = this.calendarDate.getMonth();

        // Month Title
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        titleEl.textContent = `${monthNames[month]} ${year}`;

        // Get first day of month and total days
        const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
        const totalDays = new Date(year, month + 1, 0).getDate();
        const prevMonthTotalDays = new Date(year, month, 0).getDate();

        // Calculate total cells needed in grid (multiple of 7)
        const totalCells = Math.ceil((firstDayIndex + totalDays) / 7) * 7;

        const today = new Date();

        for (let i = 0; i < totalCells; i++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-day-cell';
            
            let dayNumber;
            let currentCellDateStr;
            let isOtherMonth = false;

            if (i < firstDayIndex) {
                // Previous month days
                dayNumber = prevMonthTotalDays - firstDayIndex + i + 1;
                isOtherMonth = true;
                cell.classList.add('other-month');
                const prevM = month === 0 ? 12 : month;
                const prevY = month === 0 ? year - 1 : year;
                currentCellDateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
            } else if (i >= firstDayIndex + totalDays) {
                // Next month days
                dayNumber = i - (firstDayIndex + totalDays) + 1;
                isOtherMonth = true;
                cell.classList.add('other-month');
                const nextM = month === 11 ? 1 : month + 2;
                const nextY = month === 11 ? year + 1 : year;
                currentCellDateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
            } else {
                // Current month days
                dayNumber = i - firstDayIndex + 1;
                currentCellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
                if (year === today.getFullYear() && month === today.getMonth() && dayNumber === today.getDate()) {
                    cell.classList.add('today');
                }
            }

            // Day Top Bar (Day number + Add task button)
            cell.innerHTML = `
                <div class="calendar-day-top">
                    <span class="day-number">${dayNumber}</span>
                    <button class="btn-add-event" title="Add Task on this day">+</button>
                </div>
                <div class="calendar-events-container"></div>
            `;

            const eventsContainer = cell.querySelector('.calendar-events-container');

            // Find Projects with Deadline on this day
            const projectDeadlines = this.data.projects.filter(p => p.deadline === currentCellDateStr);
            projectDeadlines.forEach(p => {
                const pEl = document.createElement('div');
                pEl.className = 'calendar-event project-deadline';
                pEl.innerHTML = `🎯 [Deadline] ${p.name}`;
                pEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openProjectModal(p);
                });
                eventsContainer.appendChild(pEl);
            });

            // Find Tasks due on this day
            const dayTasks = this.data.tasks.filter(t => t.dueDate === currentCellDateStr);
            dayTasks.forEach(t => {
                const tEl = document.createElement('div');
                tEl.className = `calendar-event ${t.status === 'completed' ? 'completed' : ''}`;
                const project = this.getProjectForTask(t.projectId);
                if (project) {
                    tEl.style.borderLeftColor = project.color;
                }
                tEl.innerHTML = `☑️ ${t.title}`;
                tEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openTaskModal(t);
                });
                eventsContainer.appendChild(tEl);
            });

            // Click Add Task Button
            cell.querySelector('.btn-add-event').addEventListener('click', (e) => {
                e.stopPropagation();
                this.openTaskModal(null, currentCellDateStr);
            });

            daysContainer.appendChild(cell);
        }
    }

    // AGENT SIMULATION HANDLERS
    appendConsoleLog(text, type = '') {
        const linesContainer = document.getElementById('console-log-lines');
        const line = document.createElement('div');
        line.className = 'console-line';
        const timeStr = new Date().toTimeString().split(' ')[0];
        line.innerHTML = `
            <span class="console-time">[${timeStr}]</span>
            <span class="console-text ${type}">${text}</span>
        `;
        linesContainer.appendChild(line);
        linesContainer.scrollTop = linesContainer.scrollHeight;
    }

    runAgentSimulation(agentId, btnEl) {
        const statusBadge = document.getElementById(`status-agent-${agentId}`);
        if (statusBadge.classList.contains('running')) {
            // Stop Agent
            statusBadge.className = 'agent-status-badge idle';
            statusBadge.textContent = 'Idle';
            btnEl.textContent = 'Run Agent';
            this.appendConsoleLog(`[Agent #${agentId}] Execution terminated by user.`, 'system');
            return;
        }

        // Start Agent
        statusBadge.className = 'agent-status-badge running';
        statusBadge.textContent = 'Running';
        btnEl.textContent = 'Stop Agent';

        if (agentId === '1') {
            this.appendConsoleLog(`[Task Prioritizer] Spawning Claude 3.5 Sonnet instance...`, 'system');
            setTimeout(() => this.appendConsoleLog(`[Task Prioritizer] Querying active task trees for overdue flags...`, 'tool'), 1200);
            setTimeout(() => {
                this.appendConsoleLog(`[Task Prioritizer] Success: Audited 6 tasks. Reprioritized 'Refactor frontend state' to HIGH priority.`, 'success');
                statusBadge.className = 'agent-status-badge idle';
                statusBadge.textContent = 'Idle';
                btnEl.textContent = 'Run Agent';
            }, 3500);
        } else if (agentId === '2') {
            this.appendConsoleLog(`[Deep Research Scraper] Spawning GPT-4o autonomous scraper...`, 'system');
            setTimeout(() => this.appendConsoleLog(`[Deep Research Scraper] Tool call: web_search(query: 'latest state management paradigms 2026')...`, 'tool'), 1500);
            setTimeout(() => {
                this.appendConsoleLog(`[Deep Research Scraper] Success: Appended 3 relevant architectural reference links to Skills Folder 'Full-Stack Web Architecture'.`, 'success');
                statusBadge.className = 'agent-status-badge idle';
                statusBadge.textContent = 'Idle';
                btnEl.textContent = 'Run Agent';
            }, 4000);
        } else if (agentId === '3') {
            this.appendConsoleLog(`[Refactor & Cleanup] Spawning Gemini 1.5 Pro context evaluator...`, 'system');
            setTimeout(() => this.appendConsoleLog(`[Refactor & Cleanup] Verifying localStorage consistency and purging abandoned project mappings...`, 'tool'), 1000);
            setTimeout(() => {
                this.appendConsoleLog(`[Refactor & Cleanup] Success: Workspace state verified. Zero orphaned data objects detected.`, 'success');
                statusBadge.className = 'agent-status-badge idle';
                statusBadge.textContent = 'Idle';
                btnEl.textContent = 'Run Agent';
            }, 3000);
        }
    }

    triggerGlobalWorkspaceSynthesis() {
        this.appendConsoleLog(`[Global Workspace Synthesis] Spawning multi-model agent cluster...`, 'system');
        setTimeout(() => this.appendConsoleLog(`[Synthesis] Analyzing active project milestones against daily report reflections...`, 'tool'), 1200);
        setTimeout(() => this.appendConsoleLog(`[Synthesis] Extracting key metrics: ${this.data.tasks.length} total tasks, ${this.data.projects.length} active projects...`, 'tool'), 2500);
        setTimeout(() => {
            this.appendConsoleLog(`[Synthesis] COMPLETE: Workspace health index is 98.4%. Ready for presentation.`, 'success');
            alert('🎉 Global Workspace Synthesis complete! All background agents report peak workspace health.');
        }, 4000);
    }

    runCustomPromptSimulation(prompt) {
        setTimeout(() => this.appendConsoleLog(`[Agent Mode] Invoking router for prompt...`, 'system'), 800);
        setTimeout(() => this.appendConsoleLog(`[Agent Mode] Inspecting project database for relevance to "${prompt.slice(0, 25)}..."`, 'tool'), 2000);
        setTimeout(() => {
            this.appendConsoleLog(`[Agent Mode] Autonomous execution complete. Action successfully synthesized into memory buffer.`, 'success');
        }, 3800);
    }

    // MODAL OPENERS & HANDLERS
    openTaskModal(task = null, initialDueDate = '') {
        const modal = document.getElementById('modal-task');
        const titleEl = document.getElementById('modal-task-title');
        const deleteBtn = document.getElementById('btn-delete-task');
        
        const idInput = document.getElementById('task-id');
        const titleInput = document.getElementById('task-title');
        const descInput = document.getElementById('task-desc');
        const projectSelect = document.getElementById('task-project');
        const dueInput = document.getElementById('task-due');
        const prioritySelect = document.getElementById('task-priority');
        const statusSelect = document.getElementById('task-status');

        if (task) {
            titleEl.textContent = 'Edit Task';
            deleteBtn.classList.remove('hidden');
            idInput.value = task.id;
            titleInput.value = task.title;
            descInput.value = task.description || '';
            projectSelect.value = task.projectId || '';
            dueInput.value = task.dueDate || '';
            prioritySelect.value = task.priority || 'medium';
            statusSelect.value = task.status || 'todo';
        } else {
            titleEl.textContent = 'New Task';
            deleteBtn.classList.add('hidden');
            idInput.value = '';
            titleInput.value = '';
            descInput.value = '';
            projectSelect.value = this.filters.project !== 'all' ? this.filters.project : '';
            dueInput.value = initialDueDate || '';
            prioritySelect.value = 'medium';
            statusSelect.value = 'todo';
        }

        modal.classList.remove('hidden');
        titleInput.focus();
    }

    saveTaskForm() {
        const id = document.getElementById('task-id').value;
        const title = document.getElementById('task-title').value.trim();
        const description = document.getElementById('task-desc').value.trim();
        const projectId = document.getElementById('task-project').value;
        const dueDate = document.getElementById('task-due').value;
        const priority = document.getElementById('task-priority').value;
        const status = document.getElementById('task-status').value;

        if (!title) return;

        if (id) {
            // Edit existing
            const task = this.data.tasks.find(t => t.id === id);
            if (task) {
                task.title = title;
                task.description = description;
                task.projectId = projectId;
                task.dueDate = dueDate;
                task.priority = priority;
                task.status = status;
            }
        } else {
            // Create new
            const newTask = {
                id: 'task-' + Date.now(),
                title,
                description,
                projectId,
                dueDate,
                priority,
                status
            };
            this.data.tasks.unshift(newTask);
        }

        document.getElementById('modal-task').classList.add('hidden');
        this.saveData();
        if (this.currentView === 'daily_report') this.renderDailyReport();
    }

    openProjectModal(project = null) {
        const modal = document.getElementById('modal-project');
        const titleEl = document.getElementById('modal-project-title');
        const deleteBtn = document.getElementById('btn-delete-project');

        const idInput = document.getElementById('project-id');
        const nameInput = document.getElementById('project-name');
        const descInput = document.getElementById('project-desc');
        const colorInput = document.getElementById('project-color');
        const colorDisplay = document.getElementById('color-hex-display');
        const statusSelect = document.getElementById('project-status');
        const startInput = document.getElementById('project-start');
        const deadlineInput = document.getElementById('project-deadline');

        if (project) {
            titleEl.textContent = 'Edit Project';
            deleteBtn.classList.remove('hidden');
            idInput.value = project.id;
            nameInput.value = project.name;
            descInput.value = project.description || '';
            colorInput.value = project.color || '#6366f1';
            colorDisplay.textContent = project.color || '#6366f1';
            statusSelect.value = project.status || 'active';
            startInput.value = project.startDate || '';
            deadlineInput.value = project.deadline || '';
        } else {
            titleEl.textContent = 'New Project';
            deleteBtn.classList.add('hidden');
            idInput.value = '';
            nameInput.value = '';
            descInput.value = '';
            colorInput.value = '#6366f1';
            colorDisplay.textContent = '#6366f1';
            statusSelect.value = 'active';
            startInput.value = new Date().toISOString().split('T')[0];
            deadlineInput.value = '';
        }

        modal.classList.remove('hidden');
        nameInput.focus();
    }

    saveProjectForm() {
        const id = document.getElementById('project-id').value;
        const name = document.getElementById('project-name').value.trim();
        const description = document.getElementById('project-desc').value.trim();
        const color = document.getElementById('project-color').value;
        const status = document.getElementById('project-status').value;
        const startDate = document.getElementById('project-start').value;
        const deadline = document.getElementById('project-deadline').value;

        if (!name) return;

        if (id) {
            // Edit existing
            const project = this.data.projects.find(p => p.id === id);
            if (project) {
                project.name = name;
                project.description = description;
                project.color = color;
                project.status = status;
                project.startDate = startDate;
                project.deadline = deadline;
            }
        } else {
            // Create new
            const newProject = {
                id: 'proj-' + Date.now(),
                name,
                description,
                color,
                status,
                startDate,
                deadline
            };
            this.data.projects.push(newProject);
        }

        document.getElementById('modal-project').classList.add('hidden');
        this.saveData();
        if (this.currentView === 'daily_report') this.renderDailyReport();
    }

    openSkillModal(skill = null) {
        const modal = document.getElementById('modal-skill');
        const titleEl = document.getElementById('modal-skill-title');
        const deleteBtn = document.getElementById('btn-delete-skill');

        const idInput = document.getElementById('skill-id');
        const nameInput = document.getElementById('skill-name');
        const descInput = document.getElementById('skill-desc');
        const levelSelect = document.getElementById('skill-level');
        const notesInput = document.getElementById('skill-notes');

        if (skill) {
            titleEl.textContent = 'Edit Skill Folder';
            deleteBtn.classList.remove('hidden');
            idInput.value = skill.id;
            nameInput.value = skill.name;
            descInput.value = skill.description || '';
            levelSelect.value = skill.level || 'intermediate';
            notesInput.value = skill.notes || '';
        } else {
            titleEl.textContent = 'New Skill Folder';
            deleteBtn.classList.add('hidden');
            idInput.value = '';
            nameInput.value = '';
            descInput.value = '';
            levelSelect.value = 'intermediate';
            notesInput.value = '';
        }

        modal.classList.remove('hidden');
        nameInput.focus();
    }

    saveSkillForm() {
        const id = document.getElementById('skill-id').value;
        const name = document.getElementById('skill-name').value.trim();
        const description = document.getElementById('skill-desc').value.trim();
        const level = document.getElementById('skill-level').value;
        const notes = document.getElementById('skill-notes').value.trim();

        if (!name) return;

        if (id) {
            // Edit existing
            const skill = this.data.skills.find(s => s.id === id);
            if (skill) {
                skill.name = name;
                skill.description = description;
                skill.level = level;
                skill.notes = notes;
            }
        } else {
            // Create new
            const newSkill = {
                id: 'skill-' + Date.now(),
                name,
                description,
                level,
                notes
            };
            this.data.skills.push(newSkill);
        }

        document.getElementById('modal-skill').classList.add('hidden');
        this.saveData();
        if (this.currentView === 'daily_report') this.renderDailyReport();
    }
}

// Instantiate App
document.addEventListener('DOMContentLoaded', () => {
    window.appState = new AppState();
});
