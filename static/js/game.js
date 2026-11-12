var base_font_size = 192,
    vowels = ['a', 'e', 'i', 'o', 'u'],
    solved = [],
    hint_timer = null,
    answers_visible = false,
    words = [],
    current_letters = '',
    clusters_by_consonants = Object.create(null),
    words_by_consonant_length = Object.create(null),
    dictionary_loaded = false;

function resizeInputText() {
    var el = $('#game_input')[0];
    if (!el || el.clientWidth === 0) {
        return;
    }

    $(el).css({
        fontSize: base_font_size,
        paddingTop: 0
    });

    while (el.scrollWidth > el.clientWidth) {
        var size = parseFloat($(el).css('font-size'));
        if (size <= 16) {
            break;
        }
        var new_size = size - 1;
        $(el).css({
            fontSize: new_size,
            paddingTop: (base_font_size - new_size) / 2
        });
    }
}

function checkWord() {
    var input = $('#game_input').val().toLowerCase().trim();

    // Already solved
    if (solved.indexOf(input) !== -1) {
        $('body').addClass('previous');
        return true;
    }

    if (words.indexOf(input) !== -1) {
        // The word was correct!
        $('body').addClass('correct');

        // Add to the solved list.
        solved.push(input);

        // Show the answer on the page.
        $('.answer[data-value="' + input + '"]').show();
        $('.answers-' + input.length).show();

        // Update the count.
        var len_count = 0;
        for (var i = 0; i < solved.length; i++) {
            if (solved[i].length === input.length) {
                len_count++;
            }
        }
        $('.track-' + input.length).html(len_count);
    } else {
        $('body').addClass('incorrect');
    }
}

function provideHint() {
    clearTimeout(hint_timer);

    // Look for an unsolved word.
    var el = $('.answer').not(':visible')[0];

    if (typeof el === "undefined") {
        $('#hint h1').html('');
        return;
    }

    var word = $(el).attr('data-value');

    // Get the number of vowels.
    var word_vowels = [];

    for (var i = 0; i < vowels.length; i++) {
        var count = (word.match(new RegExp(vowels[i], 'g')) || []).length;

        if (count > 0) {
            word_vowels.push(count + 'x ' + vowels[i].toLowerCase());
        }
    }

    $('#hint h1').html("Hint: " + word_vowels.join("&nbsp;&nbsp;"));

    hint_timer = setTimeout(function () {
        $('#hint h1').html('');
    }, 5000);
}

function getLettersFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var fromQuery = params.get('letters');
    if (fromQuery) {
        return fromQuery.toLowerCase().trim();
    }

    var hash = window.location.hash.replace(/^#/, '');
    if (hash.indexOf('letters=') === 0) {
        hash = decodeURIComponent(hash.slice('letters='.length));
    }
    return hash.toLowerCase().trim();
}

function updateUrlForLetters(letters, mode) {
    if (!window.history || !window.history.replaceState) {
        return;
    }
    var url = new URL(window.location.href);
    url.searchParams.set('letters', letters);
    url.hash = '';
    if (mode === 'push') {
        window.history.pushState({ letters: letters }, '', url.toString());
    } else if (mode === 'replace') {
        window.history.replaceState({ letters: letters }, '', url.toString());
    }
}

function pickWordSet(length, difficulty, attempt, letters, excludeLetters) {
    length = parseInt(length, 10);
    difficulty = parseInt(difficulty, 10);
    attempt = attempt || 1;

    if (!letters) {
        var candidates = words_by_consonant_length[length] || [];
        if (candidates.length > 0) {
            var chosen = candidates[Math.floor(Math.random() * candidates.length)];
            letters = chosen.replace(/[aeiou]/g, '');
        } else {
            return {
                letters: '',
                possible: Object.create(null),
                lengths: [],
                allWords: []
            };
        }
    }

    if (excludeLetters && letters === excludeLetters && attempt <= 20) {
        return pickWordSet(length, difficulty, attempt + 1, null, excludeLetters);
    }

    var possibilities = (clusters_by_consonants[letters] || []).slice().sort(function (a, b) {
        return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
    });

    if (possibilities.length < difficulty) {
        if (attempt > 10) {
            length = Math.max(1, length - 1);
            attempt = 0;
        }
        return pickWordSet(length, difficulty, attempt + 1, null, excludeLetters);
    }

    var grouped = Object.create(null);
    var lengths = [];
    for (var i = 0; i < possibilities.length; i++) {
        var w = possibilities[i];
        var wLen = w.length;
        if (!grouped[wLen]) {
            grouped[wLen] = [];
            lengths.push(wLen);
        }
        grouped[wLen].push(w);
    }

    return {
        letters: letters,
        possible: grouped,
        lengths: lengths,
        allWords: possibilities
    };
}

function startGame(requestedLetters, historyMode, excludeLetters) {
    clearTimeout(hint_timer);
    $('#hint h1').html('');
    $('body').removeClass('correct incorrect previous');

    solved = [];
    answers_visible = false;

    var game = pickWordSet(3, 5, 1, requestedLetters, excludeLetters);
    current_letters = game.letters;
    words = game.allWords;

    if (historyMode === 'push') {
        updateUrlForLetters(game.letters, 'push');
    } else if (historyMode === 'replace' || requestedLetters !== game.letters) {
        updateUrlForLetters(game.letters, 'replace');
    }

    var html = '<strong>Answers:</strong><br>';
    for (var i = 0; i < game.lengths.length; i++) {
        var len = game.lengths[i];
        var group = game.possible[len];
        html += len + '-letter words: <span class="track-' + len + '">0</span>/' + group.length + '.<br>';
        for (var j = 0; j < group.length; j++) {
            html += '<span class="answer" data-value="' + group[j] + '"> ' + group[j] + ' </span>';
        }
        html += '<span class="answers answers-' + len + '"><br><br></span>';
    }
    $('#answers').html(html);

    var inputEl = $('#game_input');
    inputEl.val(game.letters);
    if (inputEl[0].setSelectionRange) {
        inputEl[0].setSelectionRange(0, 0);
    }
    resizeInputText();
    inputEl.focus();

    // Help out the filthy cheaters.
    if (typeof console !== "undefined") {
        console.log("Where's the fun in cheating? You're going figure out the variable name anyway, so I'll save you the time:");
        console.log(words);
    }
}

$(function () {
    $('body').on('webkitAnimationEnd oanimationend msAnimationEnd animationend', function () {
        $('body').removeClass('correct incorrect previous');
    });

    $('#game_input').on('keydown', function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) {
            return true;
        }

        var caret = $(this).caret();

        if (e.which == 13) {  // Enter
            checkWord();
        } else if (e.which == 8) {  // Backspace
            if (caret.start > 0) {
                // Get the previous letter.
                var letter = $(this).val().charAt(caret.start - 1);

                if (vowels.indexOf(letter.toLowerCase()) !== -1) {
                    // Remove the letter manually.
                    var before = $(this).val().slice(0, caret.start - 1);
                    var after = $(this).val().slice(caret.start);
                    $(this).val(before + after);

                    // Put the caret back.
                    $(this)[0].setSelectionRange(caret.start - 1, caret.start - 1);
                } else {
                    // Move back to the previous vowel.
                    var string = $(this).val().slice(0, caret.start);

                    for (var i = 1; i <= string.length; i++) {
                        letter = string[string.length - i];

                        if (vowels.indexOf(letter.toLowerCase()) !== -1) {
                            // Move the caret to this letter (but don't delete it).
                            $(this)[0].setSelectionRange(string.length - i + 1, string.length - i + 1);

                            break;
                        }
                    }
                }
            }
        } else if (
            e.which == 65 ||  // A
            e.which == 69 ||  // E
            e.which == 73 ||  // I
            e.which == 79 ||  // O
            e.which == 85     // U
        ) {
            // Add the letter manually.
            var beforeAdd = $(this).val().substr(0, caret.start);
            var afterAdd = $(this).val().substr(caret.start);

            $(this).val(beforeAdd + String.fromCharCode(e.which) + afterAdd);

            // Put the caret back.
            $(this)[0].setSelectionRange(caret.start + 1, caret.start + 1);
        } else if (
            e.which == 37 ||  // Left arrow
            e.which == 39     // Right arrow
        ) {
            return true;
        } else if (e.which == 27) {  // Escape
            $(this).blur();
        } else if (e.which == 82) {  // R
            // Remove all vowels from the string.
            $(this).val($(this).val().replace(/[aeiou]/ig, ''));

            // Move the caret to the start.
            $(this)[0].setSelectionRange(0, 0);
        } else if (e.which == 72) {  // H
            provideHint();
        } else if (e.which == 78) {  // N
            if (dictionary_loaded) {
                startGame(null, 'push', current_letters);
            }
            return false;
        } else if (e.which == 86) {  // V
            if (!answers_visible) {
                $('.answer, .answers').show();
                answers_visible = true;
            } else {
                $('.answer, .answers').hide();
                answers_visible = false;

                for (var j = 0; j < solved.length; j++) {
                    // Show the answer on the page.
                    $('.answer[data-value="' + solved[j] + '"]').show();
                    $('.answers-' + solved[j].length).show();
                }
            }
        } else {
            var known = [
                16  // Shift
            ];

            if (known.indexOf(e.which) === -1) {
                console.debug(e.which);
            }
        }

        resizeInputText();
        return false;
    });

    $(window).on('resize', resizeInputText);

    $(window).on('popstate hashchange', function () {
        if (!dictionary_loaded) {
            return;
        }
        var urlLetters = getLettersFromUrl();
        if (urlLetters !== current_letters) {
            startGame(urlLetters || null, 'none', null);
        }
    });

    setTimeout(function () {
        $('header').addClass('seen');
    }, 50);

    $.getJSON('static/words.json', function (wordList) {
        for (var i = 0; i < wordList.length; i++) {
            var fullWord = wordList[i].toLowerCase();
            var noVowels = fullWord.replace(/[aeiou]/g, '');
            var nvLen = noVowels.length;

            if (!clusters_by_consonants[noVowels]) {
                clusters_by_consonants[noVowels] = [];
            }
            clusters_by_consonants[noVowels].push(fullWord);

            if (!words_by_consonant_length[nvLen]) {
                words_by_consonant_length[nvLen] = [];
            }
            words_by_consonant_length[nvLen].push(fullWord);
        }

        dictionary_loaded = true;
        var initialLetters = getLettersFromUrl();
        startGame(initialLetters || null, initialLetters ? 'none' : 'replace', null);
    }).fail(function () {
        $('#hint h1').text('Unable to load word list.');
    });
});
