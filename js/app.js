function App() {
    return <LandingPage />;
}

function DiamondCircles({ filled }) {
    // filled: array of 4 values, each is null, 'red', or 'blue'
    const positions = [
        { left: 0, top: '50%', transform: 'translateY(-50%)' }, // left
        { left: '50%', top: 0, transform: 'translateX(-50%)' }, // top
        { right: 0, top: '50%', transform: 'translateY(-50%)' }, // right
        { left: '50%', bottom: 0, transform: 'translateX(-50%)' }, // bottom
    ];
    return (
        <div style={{ position: 'relative', width: 60, height: 60, margin: '0 auto' }}>
            {positions.map((pos, i) => (
                <div key={i} style={{ position: 'absolute', ...pos }}>
                    <span
                        style={{
                            display: 'inline-block',
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            border: '2px solid #bbb',
                            background: filled[i] === 'red' ? 'red' : filled[i] === 'blue' ? 'blue' : 'white',
                            transition: 'background 0.2s',
                        }}
                    ></span>
                </div>
            ))}
        </div>
    );
}

function LandingPage() {
    const { Container, Row, Col, Card, Button, Modal, Form } = ReactBootstrap;
    const [gridSize, setGridSize] = React.useState(4);
    const [pendingGridSize, setPendingGridSize] = React.useState(4);
    const [filled, setFilled] = React.useState(Array(4 * 4).fill(null).map(() => Array(4).fill(null)));
    const [player, setPlayer] = React.useState('red');
    const [animateIdx, setAnimateIdx] = React.useState(null);
    const [debugLog, setDebugLog] = React.useState([]);
    const [showDebug, setShowDebug] = React.useState(false);
    const [showBoxIds, setShowBoxIds] = React.useState(false);
    const [winner, setWinner] = React.useState(null);
    const [showSettings, setShowSettings] = React.useState(false);
    const [chainAnimating, setChainAnimating] = React.useState([]);
    const [showHelp, setShowHelp] = React.useState(false);
    const [botReasoning, setBotReasoning] = React.useState("");
    const [aiBotEnabled, setAiBotEnabled] = React.useState(false);
    const [cookieConsent, setCookieConsent] = React.useState(null); // null: not asked, true: accepted, false: declined
    const [showCookieInfo, setShowCookieInfo] = React.useState(false);
    const [showMenu, setShowMenu] = React.useState(false);
    const [settingsError, setSettingsError] = React.useState("");

    function appendDebug(msg) {
        const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
        setDebugLog(log => [...log, `[${ts}] ${msg}`]);
    }

    function getNeighbors(idx) {
        const neighbors = [];
        const row = Math.floor(idx / gridSize);
        const col = idx % gridSize;
        if (row > 0) neighbors.push((row - 1) * gridSize + col); // up
        if (row < gridSize - 1) neighbors.push((row + 1) * gridSize + col); // down
        if (col > 0) neighbors.push(row * gridSize + (col - 1)); // left
        if (col < gridSize - 1) neighbors.push(row * gridSize + (col + 1)); // right
        return neighbors;
    }

    // Helper to animate chain reaction for a block
    function animateChainBlock(idx, delay = 0) {
        setTimeout(() => {
            setChainAnimating(anim => [...anim, idx]);
            setTimeout(() => {
                setChainAnimating(anim => anim.filter(i => i !== idx));
            }, 400); // animation duration
        }, delay);
    }

    // Modified fillBox to animate chain reaction
    function fillBox(newFilled, idx, color, depth = 0, forceChain = false) {
        appendDebug(`fillBox(idx=${idx}, color=${color}, depth=${depth}, forceChain=${forceChain}) ENTRY`);
        animateChainBlock(idx, depth * 120); // animate with delay per depth
        // Track previous color (if all circles were the same and full)
        const wasFull = newFilled[idx].every(v => v !== null);
        const prevIsMixed = wasFull && new Set(newFilled[idx]).size > 1;
        const prevColor = wasFull && !prevIsMixed ? newFilled[idx][0] : null;
        // Find first empty circle
        const nextCircle = newFilled[idx].findIndex(v => v === null);
        if (nextCircle !== -1) {
            appendDebug(`fillBox(idx=${idx}) filling circle ${nextCircle} with ${color}`);
            newFilled[idx][nextCircle] = color;
            // If this was the last empty spot, always trigger chain reaction
            if (newFilled[idx].every(v => v !== null)) {
                appendDebug(`fillBox(idx=${idx}) last spot filled, changing all circles to ${color}`);
                newFilled[idx] = newFilled[idx].map(() => color);
            }
        }
        // Check if all circles are now the same color and full
        const nowFull = newFilled[idx].every(v => v !== null);
        const nowSameColor = newFilled[idx].every(v => v === color);
        appendDebug(`fillBox(idx=${idx}) nowFull=${nowFull}, nowSameColor=${nowSameColor}`);
        if (nowFull && nowSameColor) {
            // Only chain if color changed, forced by chain reaction, or previous was mixed
            if (prevColor !== color || forceChain || prevIsMixed) {
                appendDebug(`fillBox(idx=${idx}) chain reaction proceeds (prevColor=${prevColor}, color=${color}, forceChain=${forceChain}, prevIsMixed=${prevIsMixed})`);
                appendDebug(`fillBox(idx=${idx}) color changed from ${prevColor} to ${color}, chaining to neighbors`);
                getNeighbors(idx).forEach(nIdx => {
                    // If neighbor is full and has mixed color or all opposite color, set all to color
                    let neighborJustChanged = false;
                    if (newFilled[nIdx].every(v => v !== null)) {
                        if (newFilled[nIdx].some(v => v !== color) && !newFilled[nIdx].every(v => v !== color)) {
                            appendDebug(`fillBox(idx=${idx}) neighbor ${nIdx} is full and mixed, setting all to ${color}`);
                            neighborJustChanged = true;
                        } else if (newFilled[nIdx].every(v => v !== color)) {
                            appendDebug(`fillBox(idx=${idx}) neighbor ${nIdx} is full and all opposite, setting all to ${color}`);
                            neighborJustChanged = true;
                        }
                        if (
                            newFilled[nIdx].some(v => v !== color) || newFilled[nIdx].every(v => v !== color)
                        ) {
                            appendDebug(`fillBox(idx=${idx}) changing all circles of neighbor ${nIdx} to ${color}`);
                            newFilled[nIdx] = newFilled[nIdx].map(v => color);
                        }
                    } else {
                        appendDebug(`fillBox(idx=${idx}) neighbor ${nIdx} is not full, skipping color change`);
                    }
                    // Recursively fill neighbor, force chain if neighborJustChanged
                    appendDebug(`fillBox(idx=${idx}) calling fillBox for neighbor ${nIdx} (forceChain=${neighborJustChanged})`);
                    fillBox(newFilled, nIdx, color, depth + 1, neighborJustChanged);
                });
            } else {
                appendDebug(`fillBox(idx=${idx}) prevColor (${prevColor}) === color (${color}), no chain reaction (prevIsMixed=${prevIsMixed})`);
            }
        }
        appendDebug(`fillBox(idx=${idx}, color=${color}, depth=${depth}, forceChain=${forceChain}) EXIT`);
        return true;
    }

    const handleClick = idx => {
        appendDebug(`handleClick(idx=${idx}) ENTRY`);
        setFilled(filled => {
            const nextCircle = filled[idx].findIndex(v => v === null);
            if (nextCircle === -1) {
                appendDebug(`handleClick(idx=${idx}) box is already full, animation triggered, player not changed`);
                setAnimateIdx(idx);
                setTimeout(() => setAnimateIdx(null), 600);
                return filled; // already full, don't change player
            } else {
                appendDebug(`handleClick(idx=${idx}) found empty circle at position ${nextCircle}, filling with ${player}`);
            }
            // Fill it with current player
            const newFilled = filled.map(arr => [...arr]);
            newFilled[idx][nextCircle] = player;
            // If this was the last empty spot, check for chain reaction
            if (newFilled[idx].every(v => v !== null)) {
                const colorCount = newFilled[idx].filter(v => v === player).length;
                appendDebug(`handleClick(idx=${idx}) last spot filled, ${colorCount} circles are ${player}`);
                if (colorCount >= 3) {
                    appendDebug(`handleClick(idx=${idx}) triggering chain reaction, changing all circles to ${player}`);
                    newFilled[idx] = newFilled[idx].map(() => player);
                } else {
                    appendDebug(`handleClick(idx=${idx}) last spot filled, but not enough for chain reaction (need >=3, got ${colorCount})`);
                }
            }
            // If box is now full and all circles are the same color, chain to neighbors
            if (
                newFilled[idx].every(v => v !== null) &&
                filled[idx].some(v => v === null) &&
                newFilled[idx].every(v => v === player)
            ) {
                appendDebug(`handleClick(idx=${idx}) box is now full and all circles are ${player}, chain reaction triggered`);
                getNeighbors(idx).forEach(nIdx => {
                    // Neighbor must be full AND (mixed OR all opposite color)
                    if (
                        newFilled[nIdx].every(v => v !== null) &&
                        (
                            // mixed: contains both colors
                            newFilled[nIdx].some(v => v !== player) && !newFilled[nIdx].every(v => v !== player)
                            ||
                            // all opposite color
                            newFilled[nIdx].every(v => v !== player)
                        )
                    ) {
                        appendDebug(`handleClick(idx=${idx}) neighbor ${nIdx} is full and mixed or all opposite, setting all to ${player}`);
                        newFilled[nIdx] = newFilled[nIdx].map(v => player);
                        // Recursively fill neighbor with forceChain=true
                        appendDebug(`handleClick(idx=${idx}) calling fillBox for neighbor ${nIdx} (forceChain=true)`);
                        fillBox(newFilled, nIdx, player, 1, true);
                    } else {
                        appendDebug(`handleClick(idx=${idx}) neighbor ${nIdx} did not meet chain reaction condition`);
                        // Recursively fill neighbor with forceChain=false
                        appendDebug(`handleClick(idx=${idx}) calling fillBox for neighbor ${nIdx} (forceChain=false)`);
                        fillBox(newFilled, nIdx, player, 1, false);
                    }
                });
            } else {
                appendDebug(`handleClick(idx=${idx}) box is not full or not all ${player}, no chain reaction`);
            }
            // Check for winner
            const allFull = newFilled.every(box => box.every(v => v !== null));
            if (allFull) {
                let redCount = 0, blueCount = 0;
                newFilled.forEach(box => {
                    box.forEach(v => {
                        if (v === 'red') redCount++;
                        if (v === 'blue') blueCount++;
                    });
                });
                let msg = '';
                if (redCount > blueCount) msg = `Red wins! (${redCount} vs ${blueCount})`;
                else if (blueCount > redCount) msg = `Blue wins! (${blueCount} vs ${redCount})`;
                else msg = `It's a tie! (${redCount} vs ${blueCount})`;
                setWinner(msg);
            }
            setPlayer(player => (player === 'red' ? 'blue' : 'red'));
            appendDebug(`handleClick(idx=${idx}) player changed to ${player === 'red' ? 'blue' : 'red'}`);
            return newFilled;
        });
        appendDebug(`handleClick(idx=${idx}) EXIT`);
    };

    // Handle grid size change
    const handleApplyGridSize = () => {
        const size = parseInt(pendingGridSize);
        if (isNaN(size) || size < 2) {
            setSettingsError("Minimum grid size is 2.");
            return;
        }
        if (size > 10) {
            setSettingsError("Maximum grid size is 10.");
            return;
        }
        setGridSize(size);
        setFilled(Array(size * size).fill(null).map(() => Array(4).fill(null)));
        setPlayer('red');
        setAnimateIdx(null);
        setDebugLog([]);
        setWinner(null);
        setSettingsError("");
    };

    // Reset game state and cookie
    function handleResetGame() {
        setFilled(Array(gridSize * gridSize).fill(null).map(() => Array(4).fill(null)));
        setPlayer('red');
        setAnimateIdx(null);
        setDebugLog([]);
        setWinner(null);
        setChainAnimating([]);
        setShowHelp(false);
        setBotReasoning("");
        setAiBotEnabled(false);
        document.cookie = 'chainGame=; path=/; max-age=0'; // delete cookie
    }

    // Responsive box size calculation for mobile: ensure grid fits viewport
    const [boxSize, setBoxSize] = React.useState(90); // default
    React.useEffect(() => {
        function updateBoxSize() {
            // Padding for UI (hamburger, modals, etc)
            const paddingW = 32 + 16; // left/right + fudge
            const paddingH = 160; // top/bottom + fudge for menu/buttons
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            // Calculate max box size to fit grid in viewport
            const maxW = Math.floor((vw - paddingW) / gridSize);
            const maxH = Math.floor((vh - paddingH) / gridSize);
            const size = Math.max(32, Math.min(maxW, maxH, 90)); // min 32px, max 90px
            setBoxSize(size);
        }
        updateBoxSize();
        window.addEventListener('resize', updateBoxSize);
        window.addEventListener('orientationchange', updateBoxSize);
        return () => {
            window.removeEventListener('resize', updateBoxSize);
            window.removeEventListener('orientationchange', updateBoxSize);
        };
    }, [gridSize]);

    // Calculate grid dimensions
    const gridBgPadding = 18; // how much larger than grid (px)
    const gridRows = [];
    for (let r = 0; r < gridSize; r++) {
        gridRows.push(
            <Row key={r} className="justify-content-center" style={{ marginTop: r === 0 ? 0 : 0, marginBottom: 0 }}>
                {Array.from({ length: gridSize }, (_, c) => {
                    const i = r * gridSize + c;
                    return (
                        <Col key={i} className="d-flex justify-content-center" style={{ paddingLeft: 0, paddingRight: 0, maxWidth: boxSize }}>
                            <Card
                                onClick={() => handleClick(i)}
                                style={{
                                    cursor: 'pointer',
                                    boxShadow: animateIdx === i ? '0 0 16px 4px orange' : chainAnimating.includes(i) ? '0 0 24px 8px #ff0' : undefined,
                                    transform: chainAnimating.includes(i) ? 'scale(1.08)' : undefined,
                                    transition: 'box-shadow 0.3s, transform 0.3s',
                                    width: boxSize,
                                    minWidth: boxSize,
                                    maxWidth: boxSize,
                                    margin: '0 auto',
                                }}
                            >
                                <Card.Body className="text-center" style={{ padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', height: boxSize }}>
                                    <DiamondCircles filled={filled[i]} />
                                    {showBoxIds && (
                                        <div style={{ fontSize: 12, color: '#888', marginTop: 4, position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center' }}>ID: {i}</div>
                                    )}
                                </Card.Body>
                            </Card>
                        </Col>
                    );
                })}
            </Row>
        );
    }
    React.useEffect(() => {
        if (aiBotEnabled && player === 'blue' && !winner) {
            Promise.resolve().then(() => {
                const move = botChooseMove(filled, gridSize);
                if (move) {
                    setBotReasoning(move.reason);
                    handleClick(move.idx);
                }
            });
        }
    }, [aiBotEnabled, player, filled, winner, gridSize]);
    // Restore game state from cookie on mount
    React.useEffect(() => {
        if (cookieConsent === true) {
            // Restore game state from cookie on mount
            const cookie = document.cookie.split('; ').find(row => row.startsWith('chainGame='));
            if (cookie) {
                try {
                    const saved = JSON.parse(decodeURIComponent(cookie.split('=')[1]));
                    if (saved && saved.filled && saved.player && saved.gridSize) {
                        setFilled(saved.filled);
                        setPlayer(saved.player);
                        setGridSize(saved.gridSize);
                        setPendingGridSize(saved.gridSize);
                        setWinner(saved.winner || null);
                        setAiBotEnabled(!!saved.aiBotEnabled);
                    }
                } catch (e) { /* ignore */ }
            }
        }
    }, [cookieConsent]);

    React.useEffect(() => {
        if (cookieConsent === true) {
            const state = {
                filled,
                player,
                gridSize,
                winner,
                aiBotEnabled
            };
            document.cookie = 'chainGame=' + encodeURIComponent(JSON.stringify(state)) + '; path=/; max-age=604800'; // 7 days
        }
    }, [filled, player, gridSize, winner, aiBotEnabled, cookieConsent]);

    // On mount, load saved consent preference (if any) so we don't prompt repeatedly
    React.useEffect(() => {
        const consentCookie = document.cookie.split('; ').find(row => row.startsWith('chainConsent='));
        if (consentCookie) {
            const val = consentCookie.split('=')[1];
            setCookieConsent(val === 'true');
            setShowCookieInfo(false);
        } else {
            // no saved preference, show the prompt
            setCookieConsent(null);
            setShowCookieInfo(true);
        }
    }, []);

    // If cookieConsent becomes null later, ensure prompt is visible
    React.useEffect(() => {
        if (cookieConsent === null) {
            setShowCookieInfo(true);
        }
    }, [cookieConsent]);

    React.useEffect(() => {
        document.title = "Chain Reaction";
    }, []);

    return (
        <Container style={{ marginTop: 80, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Cookie consent prompt */}
            {showCookieInfo && cookieConsent === null && (
                <Modal show centered backdrop="static" keyboard={false}>
                    <Modal.Header>
                        <Modal.Title>Cookie Usage</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <div style={{ fontSize: 15 }}>
                            This game can save your progress in a cookie so you can resume after reloading.<br /><br />
                            <strong>If you decline, your progress will not be saved and will be lost when you reload or leave the page.</strong>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="primary" onClick={() => { document.cookie = 'chainConsent=true; path=/; max-age=31536000'; setCookieConsent(true); setShowCookieInfo(false); }}>Accept Cookies</Button>
                        <Button variant="outline-secondary" onClick={() => { setCookieConsent(false); setShowCookieInfo(false); }}>Decline</Button>
                    </Modal.Footer>
                </Modal>
            )}
            {/* Hamburger menu button */}
            <div
                style={{
                    position: 'fixed',
                    top: 16,
                    right: 16,
                    zIndex: 1100,
                    width: 48,
                    height: 48,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.85)',
                    borderRadius: '50%',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                    border: '1px solid #eee',
                    touchAction: 'manipulation',
                }}
            >
                <Button
                    variant="outline-dark"
                    size="sm"
                    onClick={() => {
                        if (showMenu) {
                            // Only close if no modal is open
                            if (!showSettings && !showHelp) setShowMenu(false);
                        } else {
                            if (!showSettings && !showHelp) setShowMenu(true);
                        }
                    }}
                    style={{ borderRadius: '50%', padding: 8, background: 'transparent', border: 'none' }}
                    aria-label="Menu"
                >
                    {/* Hamburger icon */}
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect y="6" width="28" height="3" rx="1.5" fill="#333"/>
                        <rect y="13" width="28" height="3" rx="1.5" fill="#333"/>
                        <rect y="20" width="28" height="3" rx="1.5" fill="#333"/>
                    </svg>
                </Button>
            </div>
            {/* Overlay menu layer */}
            <div
                style={{
                    position: 'fixed', // ensure overlay covers the whole viewport
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 1000,
                    display: showMenu ? 'flex' : 'none',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'opacity 0.3s',
                }}
                onMouseDown={e => {
                    // Only close if no other modal is open and click is outside the menu content
                    // Use event target to ensure only clicks outside the menu content close the menu
                    if (e.target === e.currentTarget && !showSettings && !showHelp) setShowMenu(false);
                }}
            >
                <div
                    style={{
                        width: '90vw',
                        maxWidth: 400,
                        margin: '40px auto',
                        background: 'rgba(30,30,30,0.95)',
                        borderRadius: 18,
                        boxShadow: '0 4px 32px rgba(0,0,0,0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 24,
                    }}
                >
                    <Button variant="outline-light" size="lg" onClick={() => { setShowSettings(true); }} style={{ marginBottom: 16, width: '80%', maxWidth: 320, minWidth: 180, textAlign: 'center', alignSelf: 'center' }}>
                        Settings
                    </Button>
                    <Button variant="outline-light" size="lg" onClick={() => { setShowHelp(true); }} style={{ marginBottom: 16, width: '80%', maxWidth: 320, minWidth: 180, textAlign: 'center', alignSelf: 'center' }}>
                        Help
                    </Button>
                    <Button variant="outline-danger" size="lg" onClick={handleResetGame} style={{ width: '80%', maxWidth: 320, minWidth: 180, textAlign: 'center', alignSelf: 'center' }}>
                        Reset Game
                    </Button>
                    <Button
                        variant={aiBotEnabled ? "success" : "outline-secondary"}
                        size="lg"
                        onClick={() => setAiBotEnabled(v => !v)}
                        style={{ width: '80%', marginTop: 16, maxWidth: 320, minWidth: 180, textAlign: 'center', alignSelf: 'center', boxShadow: aiBotEnabled ? '0 0 8px 2px #5bc0de' : undefined }}
                        aria-label="Toggle AI Bot"
                    >
                        {aiBotEnabled ? 'AI Bot ON' : 'AI Bot OFF'}
                    </Button>
                </div>
            </div>
            <div style={{
                position: 'relative',
                display: 'inline-block',
                margin: '0 auto',
            }}>
                {/* Background just larger than grid */}
                <div style={{
                    position: 'absolute',
                    top: -gridBgPadding,
                    left: -gridBgPadding,
                    width: gridSize * boxSize + gridBgPadding * 2,
                    height: gridSize * boxSize + gridBgPadding * 2 + 6, // only a tiny bit extra at bottom
                    zIndex: 0,
                    pointerEvents: 'none',
                    background: player === 'red' ? 'rgba(255,0,0,0.12)' : 'rgba(0,0,255,0.12)',
                    borderRadius: `${gridBgPadding}px ${gridBgPadding}px ${gridBgPadding + 6}px ${gridBgPadding + 6}px`, // slightly larger bottom radius
                    transition: 'background 0.4s',
                }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ width: gridSize * boxSize, margin: '0 auto', maxWidth: '100vw', maxHeight: '100vh', overflow: 'hidden' }}>
                        {gridRows}
                    </div>
                </div>
            </div>
            {/* Remove player turn text */}
            {showDebug && (
                <div style={{ marginTop: 40, background: '#fff', color: '#000', padding: 16, borderRadius: 8, minHeight: 80 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Debug Output:</div>
                    <pre style={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{debugLog.join('\n')}</pre>
                </div>
            )}
            <Modal show={!!winner} onHide={() => setWinner(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Game Over</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div style={{ fontSize: 18, textAlign: 'center' }}>{winner}</div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" onClick={() => setWinner(null)}>Close</Button>
                </Modal.Footer>
            </Modal>
            <Modal show={showSettings} onHide={() => { setShowSettings(false); setSettingsError(""); }} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Settings</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form className="mb-3" onSubmit={e => { e.preventDefault(); handleApplyGridSize(); }}>
                        <Form.Label className="mr-2">Grid size:</Form.Label>
                        <Form.Control
                            type="number"
                            min={2}
                            max={10}
                            value={pendingGridSize}
                            onChange={e => setPendingGridSize(e.target.value)}
                            style={{ width: 60, marginRight: 8, display: 'inline-block' }}
                        />
                        <Button variant="primary" size="sm" onClick={handleApplyGridSize} style={{ marginLeft: 8 }}>Apply</Button>
                    </Form>
                    {settingsError && (
                        <div style={{ color: '#d9534f', marginTop: 8, fontWeight: 'bold', fontSize: 15 }}>{settingsError}</div>
                    )}
                </Modal.Body>
            </Modal>
            <Modal show={showHelp} onHide={() => setShowHelp(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>How to Play</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div style={{ fontSize: 16, lineHeight: 1.6 }}>
                        <strong>Chain Reaction Game Instructions:</strong><br /><br />
                        - The game is played on a grid. Each cell contains 4 diamond circles.<br />
                        - Players take turns (Red and Blue) clicking on empty circles in any cell.<br />
                        - When a cell is filled, if 3 or more circles are the same color, all circles in that cell change to that color.<br />
                        - If a cell becomes full and all circles are the same color, a chain reaction may occur:<br />
                        &nbsp;&nbsp;• Neighboring cells that are full and either mixed or all the opposite color will also change to the current player's color.<br />
                        &nbsp;&nbsp;• This can trigger further chain reactions.<br />
                        - The game ends when all cells are full.<br />
                        - The winner is the player with the most circles of their color.<br /><br />
                        <strong>Menu & Features:</strong><br />
                        - Tap the <b>☰</b> (hamburger) button in the top right to open the menu.<br />
                        - <b>Settings</b>: Change the grid size (2-10).<br />
                        - <b>Help</b>: Show these instructions.<br />
                        - <b>Reset Game</b>: Clears all progress and starts a new game.<br />
                        - <b>AI Bot ON/OFF</b>: Toggle the AI bot. When ON, the blue player is controlled by the computer.<br />
                        - The menu closes if you tap anywhere outside the menu area, unless Settings or Help is open.<br />
                        - Game progress (grid, turn, settings, AI bot) is automatically saved in a cookie, so you can resume after reloading (if you accepted cookies).<br /><br />
                        <strong>Tip:</strong> Try to trigger chain reactions to convert more cells to your color!<br />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" onClick={() => setShowHelp(false)}>Close</Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}

function botChooseMove(filled, gridSize) {
    // For each possible move, simulate the outcome and score
    let bestIdx = null;
    let bestScore = -Infinity;
    let bestReason = "";
    for (let i = 0; i < filled.length; i++) {
        const nextCircle = filled[i].findIndex(v => v === null);
        if (nextCircle !== -1) {
            // Simulate filling this box
            const testFilled = filled.map(arr => [...arr]);
            testFilled[i][nextCircle] = 'blue';
            // If this would fill the box, check for chain reaction
            if (testFilled[i].every(v => v !== null)) {
                // Simulate chain reaction
                const simulated = simulateChainReaction(testFilled, i, 'blue', gridSize);
                const blueCount = simulated.reduce((acc, box) => acc + box.filter(v => v === 'blue').length, 0);
                const redCount = simulated.reduce((acc, box) => acc + box.filter(v => v === 'red').length, 0);
                const score = blueCount - redCount;
                if (score > bestScore) {
                    bestScore = score;
                    bestIdx = i;
                    bestReason = `Bot chooses box ${i} to trigger a chain reaction and maximize blue circles (score: ${score}).`;
                }
            } else {
                // Not last spot, just simulate placing
                const simulated = testFilled;
                const blueCount = simulated.reduce((acc, box) => acc + box.filter(v => v === 'blue').length, 0);
                const redCount = simulated.reduce((acc, box) => acc + box.filter(v => v === 'red').length, 0);
                const score = blueCount - redCount;
                if (score > bestScore) {
                    bestScore = score;
                    bestIdx = i;
                    bestReason = `Bot chooses box ${i} to maximize blue circles (score: ${score}).`;
                }
            }
        }
    }
    if (bestIdx !== null) {
        return {
            idx: bestIdx,
            reason: bestReason
        };
    }
    return null;
}

// Simulate chain reaction for bot reasoning
function simulateChainReaction(filled, idx, color, gridSize) {
    // Copy array deeply
    const newFilled = filled.map(arr => [...arr]);
    // Fill last spot and trigger chain reaction logic
    newFilled[idx] = newFilled[idx].map(() => color);
    // Chain to neighbors
    const getNeighbors = i => {
        const neighbors = [];
        const row = Math.floor(i / gridSize);
        const col = i % gridSize;
        if (row > 0) neighbors.push((row - 1) * gridSize + col);
        if (row < gridSize - 1) neighbors.push((row + 1) * gridSize + col);
        if (col > 0) neighbors.push(row * gridSize + (col - 1));
        if (col < gridSize - 1) neighbors.push(row * gridSize + (col + 1));
        return neighbors;
    };
    const queue = [idx];
    const visited = new Set();
    while (queue.length) {
        const current = queue.shift();
        visited.add(current);
        getNeighbors(current).forEach(nIdx => {
            if (!visited.has(nIdx)) {
                if (newFilled[nIdx].every(v => v !== null)) {
                    if (newFilled[nIdx].some(v => v !== color) || newFilled[nIdx].every(v => v !== color)) {
                        newFilled[nIdx] = newFilled[nIdx].map(() => color);
                        queue.push(nIdx);
                    }
                }
            }
        });
    }
    return newFilled;
}

ReactDOM.render(<App />, document.getElementById('root'));
