// D&D Playstyle Quiz - Main Logic

// Original Prompt Data (will be randomized)
const originalPrompts = [
    {
        choice1: { id: "A", text: "I care most about my character's personal story" },
        choice2: { id: "B", text: "I care most about making smart choices in combat" }
    },
    {
        choice1: { id: "C", text: "I enjoy discovering new places and secrets" },
        choice2: { id: "D", text: "I enjoy solving problems with clever plans" }
    },
    {
        choice1: { id: "E", text: "The world should behave logically, even if it hurts the story" },
        choice2: { id: "G", text: "The table having fun matters more than strict consistency" }
    },
    {
        choice1: { id: "F", text: "I enjoy building mechanically strong or clever characters" },
        choice2: { id: "A", text: "I enjoy playing characters with depth and growth" }
    },
    {
        choice1: { id: "B", text: "A tough, well-run fight is satisfying" },
        choice2: { id: "I", text: "A clean, focused session with a clear goal is satisfying" }
    },
    {
        choice1: { id: "C", text: "Running out of supplies or time makes the game interesting" },
        choice2: { id: "D", text: "Outsmarting an obstacle is more fun than fighting it" }
    },
    {
        choice1: { id: "H", text: "Tension and consequences make the game memorable" },
        choice2: { id: "G", text: "Relaxed vibes make the game enjoyable" }
    },
    {
        choice1: { id: "E", text: "Actions should have long-term consequences" },
        choice2: { id: "A", text: "Emotional payoff matters more than long-term impact" }
    },
    {
        choice1: { id: "F", text: "I like learning the rules deeply" },
        choice2: { id: "B", text: "I like applying tactics in the moment" }
    },
    {
        choice1: { id: "I", text: "I prefer sessions that feel complete on their own" },
        choice2: { id: "C", text: "I prefer ongoing discovery and travel" }
    },
    {
        choice1: { id: "D", text: "I want freedom to choose goals" },
        choice2: { id: "E", text: "I want the world to push back consistently" }
    },
    {
        choice1: { id: "H", text: "I like feeling vulnerable or underpowered" },
        choice2: { id: "F", text: "I like feeling capable and effective" }
    },
    {
        choice1: { id: "A", text: "I remember character moments most" },
        choice2: { id: "B", text: "I remember clutch combats most" }
    },
    {
        choice1: { id: "G", text: "I play D&D primarily to spend time with friends" },
        choice2: { id: "D", text: "I play D&D primarily to engage my brain" }
    },
    {
        choice1: { id: "I", text: "I like an \"adventure of the week\" feel" },
        choice2: { id: "H", text: "I like slow-building tension over time" }
    }
];

// Style Names Map
const styleNames = {
    A: "Narrative / Character-Driven",
    B: "Tactical / Combat-Focused",
    C: "Exploration-Focused",
    D: "Problem-Solving / Sandbox",
    E: "Simulationist",
    F: "Optimization / System Mastery",
    G: "Casual / Social",
    H: "Horror / Tension",
    I: "Episodic / Procedural"
};

// State Management
let state = {
    currentPromptIndex: 0,
    answers: Array(15).fill(null),
    styleCounts: {},
    isTransitioning: false,
    reviewMode: false,
    localStorageKey: 'dnd-playstyle-quiz-state',
    randomizedPrompts: [],
    promptOrder: [],
    choiceSwaps: []
};

// Initialize style counts
function initializeStyleCounts() {
    for (let id of 'ABCDEFGHI') {
        state.styleCounts[id] = 0;
    }
}

// Shuffle array using Fisher-Yates algorithm
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Randomize Prompts
function randomizePrompts() {
    // Create array of indices [0, 1, 2, ..., 14]
    const indices = Array.from({ length: originalPrompts.length }, (_, i) => i);
    
    // Shuffle the order
    state.promptOrder = shuffleArray(indices);
    
    // Create randomized prompts array and track choice swaps
    state.randomizedPrompts = [];
    state.choiceSwaps = [];
    
    state.promptOrder.forEach((originalIndex) => {
        const prompt = originalPrompts[originalIndex];
        const shouldSwap = Math.random() < 0.5;
        
        state.choiceSwaps.push(shouldSwap);
        
        if (shouldSwap) {
            state.randomizedPrompts.push({
                choice1: prompt.choice2,
                choice2: prompt.choice1
            });
        } else {
            state.randomizedPrompts.push({
                choice1: prompt.choice1,
                choice2: prompt.choice2
            });
        }
    });
}

// Get current prompt (using randomized order)
function getCurrentPrompt() {
    return state.randomizedPrompts[state.currentPromptIndex];
}

// Get original prompt index (for mapping answers back)
function getOriginalPromptIndex() {
    return state.promptOrder[state.currentPromptIndex];
}

// DOM Elements
const elements = {
    progressText: document.getElementById('progress-text'),
    progressFill: document.getElementById('progress-fill'),
    promptContainer: document.getElementById('question-container'),
    promptNumber: document.getElementById('question-number'),
    choiceLeft: document.getElementById('choice-left'),
    choiceRight: document.getElementById('choice-right'),
    choiceLeftText: document.querySelector('#choice-left .choice-text'),
    choiceRightText: document.querySelector('#choice-right .choice-text'),
    navigationSection: document.getElementById('navigation-section'),
    navPrev: document.getElementById('nav-prev'),
    navNext: document.getElementById('nav-next'),
    quizSection: document.getElementById('quiz-section'),
    resultsSection: document.getElementById('results-section'),
    resultsSummary: document.getElementById('results-summary'),
    resultsChart: document.getElementById('results-chart'),
    resultsAll: document.getElementById('results-all'),
    restartButton: document.getElementById('restart-button'),
    restartButtonSmall: document.getElementById('restart-button-small'),
    srAnnouncements: document.getElementById('sr-announcements'),
    copyResultsButton: document.getElementById('copy-results-button'),
    shareButton: document.getElementById('share-button'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message')
};

// Initialize Quiz
function initQuiz() {
    initializeStyleCounts();
    const loaded = loadState();
    
    // If no saved state, randomize
    if (!loaded) {
        randomizePrompts();
        saveState();
    }
    
    displayPrompt(state.currentPromptIndex);
    updateProgress();
    setupEventListeners();
    updateAccessibilityAnnouncements();
}

// Load State from localStorage
function loadState() {
    const saved = localStorage.getItem(state.localStorageKey);
    if (saved) {
        try {
            const savedState = JSON.parse(saved);
            state.currentPromptIndex = savedState.currentPromptIndex || 0;
            state.answers = savedState.answers || Array(15).fill(null);
            state.reviewMode = savedState.reviewMode || false;
            state.promptOrder = savedState.promptOrder || [];
            state.choiceSwaps = savedState.choiceSwaps || [];
            
            // Reconstruct randomized prompts from saved state
            if (state.promptOrder.length > 0 && state.choiceSwaps.length > 0) {
                state.randomizedPrompts = [];
                state.promptOrder.forEach((originalIndex, i) => {
                    const prompt = originalPrompts[originalIndex];
                    const shouldSwap = state.choiceSwaps[i];
                    
                    if (shouldSwap) {
                        state.randomizedPrompts.push({
                            choice1: prompt.choice2,
                            choice2: prompt.choice1
                        });
                    } else {
                        state.randomizedPrompts.push({
                            choice1: prompt.choice1,
                            choice2: prompt.choice2
                        });
                    }
                });
            }
            
            // Recalculate style counts from answers
            initializeStyleCounts();
            state.answers.forEach(answer => {
                if (answer !== null) {
                    state.styleCounts[answer]++;
                }
            });
            
            // Check if quiz is complete
            const allAnswered = state.answers.every(answer => answer !== null);
            if (allAnswered) {
                showResults();
            } else if (state.reviewMode) {
                enableReviewMode();
            }
            
            return true;
        } catch (err) {
            console.error('Failed to load state:', err);
            return false;
        }
    }
    return false;
}

// Save State to localStorage
function saveState() {
    try {
        const stateToSave = {
            currentPromptIndex: state.currentPromptIndex,
            answers: state.answers,
            reviewMode: state.reviewMode,
            promptOrder: state.promptOrder,
            choiceSwaps: state.choiceSwaps
        };
        localStorage.setItem(state.localStorageKey, JSON.stringify(stateToSave));
    } catch (err) {
        console.error('Failed to save state:', err);
    }
}

// Transition Guards
function startTransition() {
    state.isTransitioning = true;
    elements.promptContainer.classList.add('transitioning');
    // Disable buttons immediately
    elements.choiceLeft.disabled = true;
    elements.choiceRight.disabled = true;
    if (elements.navPrev) elements.navPrev.disabled = true;
    if (elements.navNext) elements.navNext.disabled = true;
}

function endTransition() {
    state.isTransitioning = false;
    elements.promptContainer.classList.remove('transitioning');
    // Re-enable buttons after transition
    elements.choiceLeft.disabled = false;
    elements.choiceRight.disabled = false;
    if (elements.navPrev) elements.navPrev.disabled = false;
    if (elements.navNext) elements.navNext.disabled = false;
}

// Display Prompt
function displayPrompt(index) {
    if (index < 0 || index >= state.randomizedPrompts.length) return;
    
    const prompt = getCurrentPrompt();
    const currentAnswer = state.answers[index];
    
    // Update prompt number
    elements.promptNumber.textContent = index + 1;
    
    // Update choices (only text, no letters)
    elements.choiceLeftText.textContent = prompt.choice1.text;
    elements.choiceRightText.textContent = prompt.choice2.text;
    
    // Update ARIA labels (without revealing the style id)
    elements.choiceLeft.setAttribute('aria-label', `Option 1: ${prompt.choice1.text}`);
    elements.choiceRight.setAttribute('aria-label', `Option 2: ${prompt.choice2.text}`);
    
    // Highlight current answer if in review mode
    if (state.reviewMode && currentAnswer !== null) {
        if (currentAnswer === prompt.choice1.id) {
            elements.choiceLeft.style.borderColor = 'var(--quiz-primary)';
            elements.choiceRight.style.borderColor = 'var(--quiz-border)';
        } else if (currentAnswer === prompt.choice2.id) {
            elements.choiceRight.style.borderColor = 'var(--quiz-primary)';
            elements.choiceLeft.style.borderColor = 'var(--quiz-border)';
        }
    } else {
        elements.choiceLeft.style.borderColor = 'var(--quiz-border)';
        elements.choiceRight.style.borderColor = 'var(--quiz-border)';
    }
    
    // Update navigation buttons
    updateNavigationButtons();
    
    // Focus management
    setTimeout(() => {
        elements.choiceLeft.focus();
    }, 100);
}

// Update Navigation Buttons
function updateNavigationButtons() {
    if (!state.reviewMode) return;
    
    elements.navPrev.disabled = state.currentPromptIndex === 0;
    elements.navNext.disabled = state.currentPromptIndex === state.randomizedPrompts.length - 1;
}

// Handle Choice Selection
function handleChoice(styleId) {
    if (state.isTransitioning) return;
    
    // Disable buttons immediately to prevent double-click
    elements.choiceLeft.disabled = true;
    elements.choiceRight.disabled = true;
    
    const prompt = getCurrentPrompt();
    const previousAnswer = state.answers[state.currentPromptIndex];
    
    // If changing an answer, decrement old count
    if (previousAnswer !== null && previousAnswer !== styleId) {
        state.styleCounts[previousAnswer]--;
    }
    
    // Update answer and increment count
    state.answers[state.currentPromptIndex] = styleId;
    if (previousAnswer !== styleId) {
        state.styleCounts[styleId]++;
    }
    
    saveState();
    updateAccessibilityAnnouncements();
    
    // Check if all prompts answered
    const allAnswered = state.answers.every(answer => answer !== null);
    
    if (state.reviewMode) {
        // In review mode, just update the display and stay on current prompt
        displayPrompt(state.currentPromptIndex);
        // Re-enable buttons after display update
        elements.choiceLeft.disabled = false;
        elements.choiceRight.disabled = false;
        // Show "View Results" button if all answered
        enableReviewMode();
    } else if (allAnswered) {
        // Small delay before showing results
        startTransition();
        setTimeout(() => {
            showResults();
            endTransition();
        }, 300);
    } else {
        // Advance to next prompt
        advanceToNextPrompt();
    }
}

// Advance to Next Prompt
function advanceToNextPrompt() {
    if (state.currentPromptIndex < state.randomizedPrompts.length - 1) {
        startTransition();
        
        // Wait for transition to complete
        const handleTransitionEnd = () => {
            state.currentPromptIndex++;
            displayPrompt(state.currentPromptIndex);
            updateProgress();
            endTransition();
            elements.promptContainer.removeEventListener('transitionend', handleTransitionEnd);
        };
        
        elements.promptContainer.addEventListener('transitionend', handleTransitionEnd);
        
        // Fallback timeout
        setTimeout(() => {
            if (state.isTransitioning) {
                handleTransitionEnd();
            }
        }, 500);
    } else {
        // Re-enable buttons if we can't advance
        elements.choiceLeft.disabled = false;
        elements.choiceRight.disabled = false;
    }
}

// Go to Previous Prompt
function goToPreviousPrompt() {
    if (state.isTransitioning) return;
    if (state.currentPromptIndex > 0) {
        startTransition();
        
        const handleTransitionEnd = () => {
            state.currentPromptIndex--;
            displayPrompt(state.currentPromptIndex);
            updateProgress();
            endTransition();
            elements.promptContainer.removeEventListener('transitionend', handleTransitionEnd);
        };
        
        elements.promptContainer.addEventListener('transitionend', handleTransitionEnd);
        
        setTimeout(() => {
            if (state.isTransitioning) {
                handleTransitionEnd();
            }
        }, 500);
    }
}

// Go to Next Prompt (in review mode)
function goToNextPrompt() {
    if (state.isTransitioning) return;
    if (state.currentPromptIndex < state.randomizedPrompts.length - 1) {
        startTransition();
        
        const handleTransitionEnd = () => {
            state.currentPromptIndex++;
            displayPrompt(state.currentPromptIndex);
            updateProgress();
            endTransition();
            elements.promptContainer.removeEventListener('transitionend', handleTransitionEnd);
        };
        
        elements.promptContainer.addEventListener('transitionend', handleTransitionEnd);
        
        setTimeout(() => {
            if (state.isTransitioning) {
                handleTransitionEnd();
            }
        }, 500);
    }
}

// Enable Review Mode
function enableReviewMode() {
    state.reviewMode = true;
    elements.navigationSection.classList.remove('hidden');
    updateNavigationButtons();
    
    // Add "View Results" button if all answered
    const allAnswered = state.answers.every(answer => answer !== null);
    if (allAnswered) {
        let viewResultsBtn = document.getElementById('view-results-button');
        if (!viewResultsBtn) {
            viewResultsBtn = document.createElement('button');
            viewResultsBtn.id = 'view-results-button';
            viewResultsBtn.className = 'restart-button';
            viewResultsBtn.textContent = 'View Results';
            viewResultsBtn.setAttribute('aria-label', 'View updated results');
            viewResultsBtn.addEventListener('click', () => {
                showResults();
            });
            elements.navigationSection.appendChild(viewResultsBtn);
        }
        viewResultsBtn.classList.remove('hidden');
    } else {
        const viewResultsBtn = document.getElementById('view-results-button');
        if (viewResultsBtn) {
            viewResultsBtn.classList.add('hidden');
        }
    }
    
    saveState();
}

// Start Review Mode (from results)
function startReviewMode() {
    state.currentPromptIndex = 0;
    elements.resultsSection.classList.add('hidden');
    elements.quizSection.classList.remove('hidden');
    enableReviewMode();
    displayPrompt(state.currentPromptIndex);
    updateProgress();
    updateAccessibilityAnnouncements();
}

// Update Progress
function updateProgress() {
    const answered = state.answers.filter(a => a !== null).length;
    const progress = ((answered) / state.randomizedPrompts.length) * 100;
    
    elements.progressText.textContent = `Prompt ${answered} of ${state.randomizedPrompts.length}`;
    elements.progressFill.style.width = `${progress}%`;
    elements.progressFill.setAttribute('aria-valuenow', answered);
    
    elements.progressText.setAttribute('aria-label', `Quiz progress: ${answered} of ${state.randomizedPrompts.length} prompts answered`);
}

// Calculate Results
function calculateResults() {
    const results = [];
    const totalAnswers = 15;
    
    for (let id of 'ABCDEFGHI') {
        const count = state.styleCounts[id] || 0;
        if (count > 0) {
            const percentage = Math.round((count / totalAnswers) * 100);
            results.push({
                id: id,
                name: styleNames[id],
                count: count,
                percentage: percentage
            });
        }
    }
    
    // Sort by percentage (descending), then alphabetically for ties
    results.sort((a, b) => {
        if (b.percentage !== a.percentage) {
            return b.percentage - a.percentage;
        }
        return a.id.localeCompare(b.id);
    });
    
    return results;
}

// Handle Ties
function handleTies(results) {
    // Results are already sorted with tie-breaking (alphabetical)
    // Find top 3, including all ties at 3rd place
    if (results.length === 0) return { top3: [], all: [] };
    
    const top3 = [];
    const top3Percentage = results[0].percentage;
    
    // Get all results with top percentage
    let i = 0;
    while (i < results.length && results[i].percentage === top3Percentage) {
        top3.push(results[i]);
        i++;
    }
    
    // If we have less than 3, get second place
    if (top3.length < 3 && i < results.length) {
        const secondPercentage = results[i].percentage;
        while (i < results.length && results[i].percentage === secondPercentage && top3.length < 3) {
            top3.push(results[i]);
            i++;
        }
    }
    
    // If we have less than 3, get third place (including all ties)
    if (top3.length < 3 && i < results.length) {
        const thirdPercentage = results[i].percentage;
        while (i < results.length && results[i].percentage === thirdPercentage) {
            top3.push(results[i]);
            i++;
        }
    }
    
    return { top3: top3, all: results };
}

// Display Results
function displayResults() {
    const { top3, all } = handleTies(calculateResults());
    
    // Hide quiz section, show results
    elements.quizSection.classList.add('hidden');
    elements.navigationSection.classList.add('hidden');
    elements.resultsSection.classList.remove('hidden');
    
    // Add review button if not already present
    if (!document.getElementById('review-answers-button')) {
        const reviewButton = document.createElement('button');
        reviewButton.id = 'review-answers-button';
        reviewButton.className = 'restart-button';
        reviewButton.textContent = 'Review Answers';
        reviewButton.setAttribute('aria-label', 'Review and edit your answers');
        reviewButton.addEventListener('click', startReviewMode);
        elements.resultsSection.insertBefore(reviewButton, elements.restartButton);
    }
    
    // Set up share button event listeners
    if (elements.copyResultsButton) {
        elements.copyResultsButton.onclick = copyResults;
    }
    if (elements.shareButton) {
        elements.shareButton.onclick = shareResults;
    }
    
    // Display Top 3
    elements.resultsSummary.innerHTML = '';
    top3.forEach((result, index) => {
        const rank = index === 0 ? '1st' : index === 1 ? '2nd' : '3rd';
        const item = document.createElement('div');
        item.className = 'result-item top-3';
        item.innerHTML = `
            <div class="result-rank">${rank} Place</div>
            <div class="result-name">${result.name}</div>
            <div class="result-percentage">${result.percentage}%</div>
        `;
        elements.resultsSummary.appendChild(item);
    });
    
    // Display Bar Chart
    elements.resultsChart.innerHTML = '';
    top3.forEach((result) => {
        const chartItem = document.createElement('div');
        chartItem.className = 'chart-item';
        chartItem.innerHTML = `
            <div class="chart-label">
                <span class="chart-name">${result.name}</span>
                <span class="chart-percentage">${result.percentage}%</span>
            </div>
            <div class="chart-bar-container">
                <div class="chart-bar" style="width: ${result.percentage}%">${result.percentage}%</div>
            </div>
        `;
        elements.resultsChart.appendChild(chartItem);
    });
    
    // Display All Results (without showing style IDs)
    elements.resultsAll.innerHTML = '<div class="all-results-title">All Results</div>';
    const allList = document.createElement('div');
    allList.className = 'all-results-list';
    
    all.forEach((result) => {
        const item = document.createElement('div');
        item.className = 'all-results-item';
        item.innerHTML = `
            <span class="all-results-name">${result.name}</span>
            <span class="all-results-percentage">${result.percentage}%</span>
        `;
        allList.appendChild(item);
    });
    
    elements.resultsAll.appendChild(allList);
    
    // Focus management
    setTimeout(() => {
        elements.resultsSection.focus();
    }, 100);
    
    updateAccessibilityAnnouncements('results');
}

// Build Share Text
function buildShareText(results) {
    const { top3, all } = handleTies(results);
    let text = 'My D&D Playstyle Results:\n';
    
    // Top 3
    top3.forEach((result, index) => {
        const rank = index + 1;
        text += `${rank}) ${result.name} ${result.percentage}%\n`;
    });
    
    // Full breakdown (include all results)
    if (all.length > 0) {
        text += '\nFull breakdown: ';
        const breakdown = all.map(r => `${r.name} ${r.percentage}%`).join(', ');
        text += breakdown;
        text += '\n';
    }
    
    // Add URL
    text += `\n${location.href}`;
    
    return text;
}

// Show Toast
function showToast(message) {
    elements.toastMessage.textContent = message;
    elements.toast.classList.remove('hidden');
    
    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 2000);
}

// Copy Results to Clipboard
async function copyResults() {
    const results = calculateResults();
    const shareText = buildShareText(results);
    
    try {
        await navigator.clipboard.writeText(shareText);
        showToast('Copied!');
    } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = shareText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            showToast('Copied!');
        } catch (fallbackErr) {
            showToast('Failed to copy');
            console.error('Failed to copy:', fallbackErr);
        }
        
        document.body.removeChild(textarea);
    }
}

// Share Results
async function shareResults() {
    const results = calculateResults();
    const shareText = buildShareText(results);
    const title = 'My D&D Playstyle Results';
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: title,
                text: shareText,
                url: location.href
            });
        } catch (err) {
            // User cancelled or error occurred
            if (err.name !== 'AbortError') {
                console.error('Error sharing:', err);
                // Fallback to copy
                copyResults();
            }
        }
    } else {
        // Fallback to copy
        copyResults();
    }
}

// Show Results
function showResults() {
    displayResults();
}

// Restart Quiz
function restartQuiz() {
    if (confirm('Are you sure you want to start over? All your answers will be lost.')) {
        state.currentPromptIndex = 0;
        state.answers = Array(15).fill(null);
        state.reviewMode = false;
        initializeStyleCounts();
        
        // Clear localStorage and re-randomize
        localStorage.removeItem(state.localStorageKey);
        randomizePrompts();
        saveState();
        
        elements.quizSection.classList.remove('hidden');
        elements.resultsSection.classList.add('hidden');
        elements.navigationSection.classList.add('hidden');
        
        displayPrompt(0);
        updateProgress();
        updateAccessibilityAnnouncements();
        
        elements.choiceLeft.focus();
    }
}

// Update Accessibility Announcements
function updateAccessibilityAnnouncements(context = 'prompt') {
    if (context === 'prompt') {
        const answered = state.answers.filter(a => a !== null).length;
        const announcement = `Prompt ${state.currentPromptIndex + 1} of ${state.randomizedPrompts.length}. ${answered} prompts answered.`;
        elements.srAnnouncements.textContent = announcement;
    } else if (context === 'results') {
        const { top3 } = handleTies(calculateResults());
        let announcement = 'Quiz complete. Your top playstyle preferences: ';
        top3.forEach((result, index) => {
            const rank = index === 0 ? 'first' : index === 1 ? 'second' : 'third';
            announcement += `${rank}, ${result.name} at ${result.percentage} percent. `;
        });
        elements.srAnnouncements.textContent = announcement;
    }
}

// Keyboard Navigation
function handleKeyboardNavigation(event) {
    if (state.isTransitioning) return;
    
    // Don't interfere with form inputs or when typing
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }
    
    switch (event.key) {
        case 'ArrowLeft':
            event.preventDefault();
            if (state.reviewMode && state.currentPromptIndex > 0) {
                goToPreviousPrompt();
            } else {
                elements.choiceLeft.click();
            }
            break;
        case 'ArrowRight':
            event.preventDefault();
            if (state.reviewMode && state.currentPromptIndex < state.randomizedPrompts.length - 1) {
                goToNextPrompt();
            } else {
                elements.choiceRight.click();
            }
            break;
        case 'Enter':
            if (document.activeElement === elements.choiceLeft || document.activeElement === elements.choiceRight) {
                event.preventDefault();
                document.activeElement.click();
            }
            break;
        case 'Escape':
            if (state.reviewMode) {
                event.preventDefault();
                // Could implement cancel review mode if needed
            }
            break;
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Choice buttons
    elements.choiceLeft.addEventListener('click', () => {
        if (!state.isTransitioning) {
            const prompt = getCurrentPrompt();
            handleChoice(prompt.choice1.id);
        }
    });
    
    elements.choiceRight.addEventListener('click', () => {
        if (!state.isTransitioning) {
            const prompt = getCurrentPrompt();
            handleChoice(prompt.choice2.id);
        }
    });
    
    // Navigation buttons
    elements.navPrev.addEventListener('click', goToPreviousPrompt);
    elements.navNext.addEventListener('click', goToNextPrompt);
    
    // Restart buttons
    elements.restartButton.addEventListener('click', restartQuiz);
    elements.restartButtonSmall.addEventListener('click', restartQuiz);
    
    // Share buttons (will be set up when results are displayed)
    if (elements.copyResultsButton) {
        elements.copyResultsButton.addEventListener('click', copyResults);
    }
    if (elements.shareButton) {
        elements.shareButton.addEventListener('click', shareResults);
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboardNavigation);
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQuiz);
} else {
    initQuiz();
}
