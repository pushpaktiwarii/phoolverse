import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function TicTacToeGame({ gameState, onUpdateGame, username, roomUsers = [] }) {
    const { board, turn, players, winner, winningLine } = gameState;

    const isMyTurn = turn === username;
    const amIPlayer = players && (players.X === username || players.O === username);
    const isGameActive = !!players;

    const handleJoin = (symbol) => {
        if (!gameState.players) {
            onUpdateGame({
                players: { [symbol]: username },
                type: 'tictactoe',
                board: Array(9).fill(null),
                turn: username // First joiner starts? Or wait for both?
            });
        } else {
            // Second player joining
            const newPlayers = { ...gameState.players, [symbol]: username };

            // Random first turn or X always starts? X starts.
            const firstTurn = newPlayers.X;

            onUpdateGame({
                players: newPlayers,
                turn: firstTurn
            });
        }
    };

    const handleCellPress = (index) => {
        if (!isGameActive || winner) return;
        if (!isMyTurn) return;
        if (board[index]) return;

        const mySymbol = players.X === username ? 'X' : 'O';
        const newBoard = [...board];
        newBoard[index] = mySymbol;

        // Check Win
        const winInfo = checkWinner(newBoard);
        const nextTurn = players.X === username ? players.O : players.X;

        if (winInfo) {
            onUpdateGame({
                board: newBoard,
                winner: winInfo.winner,
                winningLine: winInfo.line,
                turn: null
            });
        } else if (!newBoard.includes(null)) {
            // Draw
            onUpdateGame({
                board: newBoard,
                winner: 'DRAW',
                turn: null
            });
        } else {
            // Next Turn
            onUpdateGame({
                board: newBoard,
                turn: nextTurn
            });
        }
    };

    const handleReset = () => {
        // Keep players, reset board
        if (!players) return;

        onUpdateGame({
            board: Array(9).fill(null),
            winner: null,
            winningLine: null,
            turn: players.X // X starts again
        });
    };

    const handleQuit = () => {
        onUpdateGame({
            type: null,
            players: null,
            board: null,
            winner: null,
            turn: null
        });
    }

    const checkWinner = (squares) => {
        const lines = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6],
        ];
        for (let i = 0; i < lines.length; i++) {
            const [a, b, c] = lines[i];
            if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
                return { winner: squares[a], line: lines[i] };
            }
        }
        return null;
    };

    // --- RENDER ---

    if (!players || (!players.X || !players.O)) {
        // Lobby Mode: Waiting for Players
        const xPlayer = players?.X;
        const oPlayer = players?.O;

        return (
            <View style={styles.container}>
                <Text style={styles.title}>Tic Tac Toe</Text>
                <View style={styles.lobbyContainer}>
                    <TouchableOpacity
                        style={[styles.ioButton, xPlayer && styles.ioButtonTaken]}
                        onPress={() => !xPlayer && handleJoin('X')}
                        disabled={!!xPlayer}
                    >
                        <Text style={styles.ioText}>X</Text>
                        <Text style={styles.playerName}>{xPlayer || "Tap to Join"}</Text>
                    </TouchableOpacity>

                    <Text style={styles.vsText}>VS</Text>

                    <TouchableOpacity
                        style={[styles.ioButton, oPlayer && styles.ioButtonTaken]}
                        onPress={() => !oPlayer && handleJoin('O')}
                        disabled={!!oPlayer}
                    >
                        <Text style={styles.ioText}>O</Text>
                        <Text style={styles.playerName}>{oPlayer || "Tap to Join"}</Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.quitBtn} onPress={handleQuit}>
                    <Text style={styles.quitText}>Exit Game</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Active Game
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={[styles.playerTag, turn === players.X && styles.activeTag]}>
                    <Text style={[styles.playerText, { color: '#FF6B6B' }]}>X: {players.X}</Text>
                </View>
                <View style={[styles.playerTag, turn === players.O && styles.activeTag]}>
                    <Text style={[styles.playerText, { color: '#4ECDC4' }]}>O: {players.O}</Text>
                </View>
            </View>

            <View style={styles.board}>
                {board.map((cell, index) => {
                    const isWinningCell = winningLine?.includes(index);
                    return (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.cell,
                                isWinningCell && styles.winningCell,
                                !cell && isMyTurn && !winner && styles.activeCell
                            ]}
                            onPress={() => handleCellPress(index)}
                            activeOpacity={0.8}
                        >
                            <Text style={[
                                styles.cellText,
                                cell === 'X' ? { color: '#FF6B6B' } : { color: '#4ECDC4' }
                            ]}>
                                {cell}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.statusArea}>
                {winner ? (
                    <View style={styles.resultBox}>
                        <Text style={styles.resultText}>
                            {winner === 'DRAW' ? "It's a Draw!" : `${players[winner]} Wins! 🎉`}
                        </Text>
                        <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                            <Text style={styles.resetText}>Play Again</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quitSmallBtn} onPress={handleQuit}>
                            <Text style={styles.quitSmallText}>Quit</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <Text style={styles.turnText}>
                        {isMyTurn ? "Your Turn!" : `Waiting for ${turn}...`}
                    </Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111',
        width: '100%',
    },
    title: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 30,
    },
    lobbyContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
        marginBottom: 30
    },
    ioButton: {
        width: 100,
        height: 100,
        backgroundColor: '#222',
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#444'
    },
    ioButtonTaken: {
        borderColor: '#6C5CE7',
        backgroundColor: '#1a1a1a'
    },
    ioText: {
        fontSize: 40,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 5
    },
    playerName: {
        color: '#aaa',
        fontSize: 12,
        textAlign: 'center'
    },
    vsText: {
        color: '#666',
        fontWeight: 'bold',
        fontSize: 20
    },

    // Game
    header: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 20,
    },
    playerTag: {
        paddingVertical: 5,
        paddingHorizontal: 15,
        borderRadius: 20,
        backgroundColor: '#222',
        borderWidth: 1,
        borderColor: 'transparent'
    },
    activeTag: {
        borderColor: '#fff',
        backgroundColor: '#333'
    },
    playerText: {
        fontWeight: 'bold',
        fontSize: 14
    },
    board: {
        width: 300,
        height: 300,
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: '#333',
        gap: 2,
        borderRadius: 5,
        overflow: 'hidden'
    },
    cell: {
        width: 98.6, // (300 - 4)/3
        height: 98.6,
        backgroundColor: '#111',
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeCell: {
        backgroundColor: '#1a1a1a'
    },
    winningCell: {
        backgroundColor: '#2d3436'
    },
    cellText: {
        fontSize: 50,
        fontWeight: 'bold'
    },
    statusArea: {
        marginTop: 30,
        alignItems: 'center',
        height: 100
    },
    turnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '500'
    },
    resultBox: {
        alignItems: 'center',
        gap: 15
    },
    resultText: {
        color: '#F1C40F',
        fontSize: 22,
        fontWeight: 'bold'
    },
    resetBtn: {
        backgroundColor: '#6C5CE7',
        paddingVertical: 10,
        paddingHorizontal: 30,
        borderRadius: 25
    },
    resetText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16
    },
    quitBtn: {
        marginTop: 20,
        padding: 10
    },
    quitText: {
        color: '#e74c3c'
    },
    quitSmallBtn: {
        marginTop: 5
    },
    quitSmallText: {
        color: '#666',
        fontSize: 12
    }
});
