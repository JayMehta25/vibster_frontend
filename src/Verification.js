import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

function Verification() {
  return (
    <div className="container">
      <h2>Email Verification Required</h2>
      <p>Please check your email for a verification link. Once verified, you can log in.</p>
      <p>If you didn't receive the email, <a href="/resend-verification">click here</a> to resend.</p>
    </div>
  );
}

export default Verification; 