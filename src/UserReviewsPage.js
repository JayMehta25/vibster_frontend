import React from 'react';
import InfiniteMenu from './components/InfiniteMenu';
import './UserReviewsPage.css';
import { useNavigate } from 'react-router-dom';

const reviews = [
  { name: 'Alex Carter', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex', text: 'Vibester made networking so easy and fun! Highly recommend.', rating: 5 },
  { name: 'Priya Singh', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya', text: 'Loved the private chat rooms and the interest matching.', rating: 4 },
  { name: 'Jordan Lee', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan', text: 'Met amazing people and made new friends. Super secure!', rating: 5 },
  { name: 'Kai Miller', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kai', text: 'The matching is pretty good, but sometimes it takes a while to find someone. Overall a solid app.', rating: 3 },
  { name: 'Taylor Kim', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Taylor', text: 'The best chat app for meeting like-minded people.', rating: 5 },
  { name: 'Morgan Patel', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Morgan', text: 'A few glitches here and there, but the dev team seems responsive. I like the core idea.', rating: 3 },
  { name: 'Jamie Brown', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jamie', text: 'I use Vibester every day. The experience is top-notch.', rating: 5 },
  { name: 'Casey Gupta', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Casey', text: 'Interest-based rooms are a game changer!', rating: 4 },
  { name: 'Riley Smith', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Riley', text: 'Secure, fast, and fun. What more could you want?', rating: 5 },
];

const menuItems = reviews.map(review => ({
    image: review.avatar,
    link: '#',
    title: review.name,
    description: review.text,
    rating: review.rating
}));

export default function UserReviewsPage() {
    const navigate = useNavigate();

    return (
        <div className="user-reviews-page-container">
            <button className="reviews-back-button" onClick={() => navigate(-1)}>← Back</button>
            <h1 className="user-reviews-page-title"></h1>
            <div style={{ height: '80vh', width: '100%', position: 'relative' }}>
                <InfiniteMenu items={menuItems} />
            </div>
        </div>
    );
} 