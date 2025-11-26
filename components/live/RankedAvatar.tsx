import React from 'react';
import { User } from '../../types';
import { avatarFrames, getRemainingDays, getFrameGlowClass } from '../../services/database';

const RankedAvatarBadge: React.FC<{ rank: number }> = ({ rank }) => {
    // Only show badges for top 3
    if (rank > 3) {
        return null;
    }

    // Define styles based on rank
    const getBadgeStyle = (): React.CSSProperties => {
        const baseStyle: React.CSSProperties = {
            position: 'absolute',
            top: '-0.5rem',
            left: '50%',
            transform: 'translateX(-50%) scale(1.1)',
            width: '1.75rem',
            height: '1.75rem',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            boxShadow: '0 0 10px 2px rgba(234, 179, 8, 0.3)',
            fontWeight: 'bold',
            fontSize: '0.75rem',
            lineHeight: '1rem',
            border: '2px solid #facc15', // yellow-400
            backgroundColor: 'rgba(0, 0, 0, 0.9)'
        };

        if (rank === 1) {
            return {
                ...baseStyle,
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                color: '#facc15',
                border: '2px solid #facc15'
            };
        } else if (rank === 2) {
            return {
                ...baseStyle,
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                color: '#facc15',
                border: '2px solid #facc15'
            };
        } else {
            return {
                ...baseStyle,
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                color: '#facc15',
                border: '2px solid #facc15'
            };
        }
    };

    return (
        <div style={getBadgeStyle()}>
            {rank}
        </div>
    );
};


interface RankedAvatarProps {
    user: User;
    rank: number;
    onClick: (user: User) => void;
}

export const RankedAvatar: React.FC<RankedAvatarProps> = ({ user, rank, onClick }) => {
    const remainingDays = getRemainingDays(user.frameExpiration);
    const activeFrame = (user.activeFrameId && remainingDays && remainingDays > 0)
      ? avatarFrames.find(f => f.id === user.activeFrameId)
      : null;
    const ActiveFrameComponent = activeFrame ? activeFrame.component : null;
    const frameGlowClass = getFrameGlowClass(user.activeFrameId);

    return (
        <button onClick={(e) => { e.stopPropagation(); onClick(user); }} className="relative shrink-0 w-8 h-8">
            <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900" />
             {ActiveFrameComponent && (
                <div className={`absolute -top-1 -left-1 w-10 h-10 pointer-events-none ${frameGlowClass}`}>
                    <ActiveFrameComponent />
                </div>
            )}
            <RankedAvatarBadge rank={rank} />
        </button>
    );
};