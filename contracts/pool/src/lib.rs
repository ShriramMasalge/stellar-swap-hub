#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

#[contracttype]
pub enum DataKey {
    ReserveA,
    ReserveB,
    TotalShares,
    Shares(Address),
    TokenA,
    TokenB,
}

#[contract]
pub struct PoolContract;

#[contractimpl]
impl PoolContract {
    pub fn initialize(env: Env, token_a: Address, token_b: Address) {
        env.storage().persistent().set(&DataKey::TokenA, &token_a);
        env.storage().persistent().set(&DataKey::TokenB, &token_b);
        env.storage().persistent().set(&DataKey::ReserveA, &0i128);
        env.storage().persistent().set(&DataKey::ReserveB, &0i128);
        env.storage().persistent().set(&DataKey::TotalShares, &0i128);
    }

    pub fn add_liq(env: Env, provider: Address, amount_a: i128, amount_b: i128) -> i128 {
        provider.require_auth();
        let reserve_a: i128 = env.storage().persistent().get(&DataKey::ReserveA).unwrap_or(0);
        let reserve_b: i128 = env.storage().persistent().get(&DataKey::ReserveB).unwrap_or(0);
        let total_shares: i128 = env.storage().persistent().get(&DataKey::TotalShares).unwrap_or(0);
        let shares = if total_shares == 0 {
            integer_sqrt(amount_a * amount_b)
        } else {
            let shares_a = (amount_a * total_shares) / reserve_a;
            let shares_b = (amount_b * total_shares) / reserve_b;
            shares_a.min(shares_b)
        };
        env.storage().persistent().set(&DataKey::ReserveA, &(reserve_a + amount_a));
        env.storage().persistent().set(&DataKey::ReserveB, &(reserve_b + amount_b));
        env.storage().persistent().set(&DataKey::TotalShares, &(total_shares + shares));
        let user_shares: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Shares(provider.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Shares(provider.clone()), &(user_shares + shares));
        env.events().publish((symbol_short!("add_liq"),), (provider, amount_a, amount_b, shares));
        shares
    }

    pub fn swap_a_b(env: Env, user: Address, amount_in: i128) -> i128 {
        user.require_auth();
        let reserve_a: i128 = env.storage().persistent().get(&DataKey::ReserveA).unwrap();
        let reserve_b: i128 = env.storage().persistent().get(&DataKey::ReserveB).unwrap();
        let amount_in_with_fee = amount_in * 997;
        let amount_out =
            (reserve_b * amount_in_with_fee) / (reserve_a * 1000 + amount_in_with_fee);
        assert!(amount_out > 0, "Insufficient output amount");
        env.storage().persistent().set(&DataKey::ReserveA, &(reserve_a + amount_in));
        env.storage().persistent().set(&DataKey::ReserveB, &(reserve_b - amount_out));
        env.events().publish((symbol_short!("swap"),), (user, amount_in, amount_out));
        amount_out
    }

    pub fn get_reserves(env: Env) -> (i128, i128) {
        let a: i128 = env.storage().persistent().get(&DataKey::ReserveA).unwrap_or(0);
        let b: i128 = env.storage().persistent().get(&DataKey::ReserveB).unwrap_or(0);
        (a, b)
    }

    pub fn quote(env: Env, amount_in: i128) -> i128 {
        let reserve_a: i128 = env.storage().persistent().get(&DataKey::ReserveA).unwrap_or(0);
        let reserve_b: i128 = env.storage().persistent().get(&DataKey::ReserveB).unwrap_or(0);
        if reserve_a == 0 || reserve_b == 0 { return 0; }
        let amount_in_with_fee = amount_in * 997;
        (reserve_b * amount_in_with_fee) / (reserve_a * 1000 + amount_in_with_fee)
    }

    pub fn get_shares(env: Env, user: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Shares(user)).unwrap_or(0)
    }
}

fn integer_sqrt(n: i128) -> i128 {
    if n <= 0 { return 0; }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x { x = y; y = (x + n / x) / 2; }
    x
}

mod test;