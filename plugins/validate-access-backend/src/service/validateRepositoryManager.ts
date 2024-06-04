import axios from 'axios';

// Function to check if a user is allowed
export const isUserAllowed = async (user: string): Promise<boolean> => {
  try {
    const token = process.env.GITHUB_TOKEN; // GitHub token with appropriate permissions

    const response = await axios.get(
      `${process.env.GITHUB_API_URL}/orgs/sadaru-tech-org1/teams/${process.env.REPO_CREATOR_TEAM}/memberships/${user}`,
      {
        headers: {
          Authorization: `token ${token}`,
        },
      },
    );

    const userAccess = response.data;
    return (
      userAccess.role &&
      ['member', 'admin'].includes(userAccess.role) &&
      userAccess.state === 'active'
    );
  } catch (error) {
    console.error('Error fetching user teams from GitHub:', error);
    return false;
  }
};
